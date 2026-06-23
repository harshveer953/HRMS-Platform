const fs = require('fs');
const path = require('path');

// Determine if we should use standard MongoDB/Mongoose (if configured)
const useMongoose = !!process.env.MONGO_URI && process.env.NODE_ENV !== 'test';

let mongooseInstance = null;
if (useMongoose) {
  try {
    mongooseInstance = require('mongoose');
    console.log(`[Database] MONGO_URI is set. Attempting MongoDB connection...`);
    mongooseInstance.connect(process.env.MONGO_URI)
      .then(() => {
        console.log("========================================================");
        console.log("✔ Connected to MongoDB Atlas/Database successfully!");
        console.log("========================================================");
      })
      .catch(err => {
        console.error("========================================================");
        console.error("❌ MongoDB connection error:", err.message);
        console.error("========================================================");
      });
  } catch (err) {
    console.warn("Mongoose package not loaded, falling back to JSON database. Error:", err.message);
  }
}

// Ensure the local .database directory exists
const DB_DIR = path.join(process.cwd(), '.database');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Helper: Deep copy helper for JSON records
function deepCopy(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}

// Helper: Generate unique 24-character hex ID (similar to Mongo ObjectIds)
function generateObjectId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const machine = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  const pid = Math.floor(Math.random() * 65535).toString(16).padStart(4, '0');
  const counter = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  return timestamp + machine + pid + counter;
}

// Helper: Check if document matches query filters (supporting standard operators)
function matchQuery(doc, query) {
  if (!query) return true;
  for (let key in query) {
    if (key === '$or') {
      const conditions = query[key];
      if (!Array.isArray(conditions)) return false;
      if (!conditions.some(cond => matchQuery(doc, cond))) return false;
      continue;
    }
    
    let val = query[key];
    let docVal = doc[key];
    
    // Support path lookup for nested fields e.g., 'profile.bankAccount'
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = doc;
      for (let part of parts) {
        current = current ? current[part] : undefined;
      }
      docVal = current;
    }

    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof RegExp)) {
      // Support advanced match operators
      for (let op in val) {
        if (op === '$in') {
          if (!Array.isArray(val[op])) return false;
          if (!val[op].includes(docVal)) return false;
        } else if (op === '$nin') {
          if (!Array.isArray(val[op])) return false;
          if (val[op].includes(docVal)) return false;
        } else if (op === '$regex') {
          let pattern = val[op];
          let flags = '';
          if (pattern instanceof RegExp) {
            flags = pattern.flags;
            pattern = pattern.source;
          }
          const regex = new RegExp(pattern, flags || 'i');
          if (!regex.test(docVal || '')) return false;
        } else if (op === '$gt') {
          if (!(docVal > val[op])) return false;
        } else if (op === '$lt') {
          if (!(docVal < val[op])) return false;
        } else if (op === '$gte') {
          if (!(docVal >= val[op])) return false;
        } else if (op === '$lte') {
          if (!(docVal <= val[op])) return false;
        } else if (op === '$ne') {
          if (docVal === val[op]) return false;
        }
      }
    } else if (val instanceof RegExp) {
      if (!val.test(docVal || '')) return false;
    } else {
      // standard equality check
      if (docVal !== val) return false;
    }
  }
  return true;
}

// Helper: Apply update instructions to document
function applyUpdate(doc, update) {
  if (update.$set) {
    for (let k in update.$set) {
      setNestedProperty(doc, k, update.$set[k]);
    }
  }
  if (update.$push) {
    for (let k in update.$push) {
      const parts = k.split('.');
      let current = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (!Array.isArray(current[lastKey])) {
        current[lastKey] = [];
      }
      current[lastKey].push(update.$push[k]);
    }
  }
  if (update.$pull) {
    for (let k in update.$pull) {
      const parts = k.split('.');
      let current = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (Array.isArray(current[lastKey])) {
        const pullCriteria = update.$pull[k];
        if (pullCriteria && typeof pullCriteria === 'object' && !Array.isArray(pullCriteria)) {
          current[lastKey] = current[lastKey].filter(item => !matchQuery(item, pullCriteria));
        } else {
          current[lastKey] = current[lastKey].filter(item => item !== pullCriteria);
        }
      }
    }
  }
  // Implicit top-level merge if no Mongo operator is used
  if (!update.$set && !update.$push && !update.$pull) {
    for (let k in update) {
      setNestedProperty(doc, k, update[k]);
    }
  }
}

// Helper: set nested object property by string path e.g., 'personal.email'
function setNestedProperty(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Local Document DB Class (Mongoose-like Model API)
class LocalJsonModel {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DB_DIR, `${name.toLowerCase()}.json`);
  }

  // Load all items synchronously
  _readData() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content || '[]');
    } catch (err) {
      console.error(`Error reading database file: ${this.filePath}`, err);
      return [];
    }
  }

  // Write items back synchronously
  _writeData(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error writing database file: ${this.filePath}`, err);
    }
  }

  async find(query = {}) {
    const list = this._readData();
    const matches = list.filter(item => matchQuery(item, query));
    return deepCopy(matches);
  }

  async findOne(query = {}) {
    const list = this._readData();
    const item = list.find(item => matchQuery(item, query));
    return item ? deepCopy(item) : null;
  }

  async findById(id) {
    return this.findOne({ _id: id });
  }

  async create(docData) {
    const list = this._readData();
    const newDoc = {
      _id: generateObjectId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...docData
    };
    list.push(newDoc);
    this._writeData(list);
    return deepCopy(newDoc);
  }

  async updateOne(query, update) {
    const list = this._readData();
    const idx = list.findIndex(item => matchQuery(item, query));
    if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
    
    const doc = list[idx];
    applyUpdate(doc, update);
    doc.updatedAt = new Date().toISOString();
    
    this._writeData(list);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query, update) {
    const list = this._readData();
    let modifiedCount = 0;
    
    list.forEach(doc => {
      if (matchQuery(doc, query)) {
        applyUpdate(doc, update);
        doc.updatedAt = new Date().toISOString();
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      this._writeData(list);
    }
    return { matchedCount: modifiedCount, modifiedCount };
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const list = this._readData();
    const idx = list.findIndex(item => item._id === id);
    if (idx === -1) return null;
    
    const doc = list[idx];
    applyUpdate(doc, update);
    doc.updatedAt = new Date().toISOString();
    
    this._writeData(list);
    return deepCopy(doc);
  }

  async deleteOne(query) {
    const list = this._readData();
    const idx = list.findIndex(item => matchQuery(item, query));
    if (idx === -1) return { deletedCount: 0 };
    
    list.splice(idx, 1);
    this._writeData(list);
    return { deletedCount: 1 };
  }

  async deleteMany(query) {
    const list = this._readData();
    const filtered = list.filter(item => !matchQuery(item, query));
    const deletedCount = list.length - filtered.length;
    
    this._writeData(filtered);
    return { deletedCount };
  }

  async countDocuments(query = {}) {
    const list = this._readData();
    return list.filter(item => matchQuery(item, query)).length;
  }
}

// Database Manager
const dbManager = {
  mongoose: mongooseInstance,
  isMock: !useMongoose,
  
  // Model cache
  models: {},

  // Define a model
  model(name, schemaDefinition = {}) {
    if (useMongoose && mongooseInstance) {
      if (mongooseInstance.models[name]) {
        return mongooseInstance.models[name];
      }
      const schema = new mongooseInstance.Schema(schemaDefinition, { timestamps: true });
      return mongooseInstance.model(name, schema);
    } else {
      if (this.models[name]) {
        return this.models[name];
      }
      const localModel = new LocalJsonModel(name);
      this.models[name] = localModel;
      return localModel;
    }
  }
};

module.exports = dbManager;
