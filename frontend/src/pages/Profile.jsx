import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const TABS = ['personal', 'contact', 'bank', 'professional', 'documents', 'lifecycle'];
const TAB_LABELS = { personal: '👤 Personal', contact: '📞 Contact', bank: '🏦 Bank & Statutory', professional: '🎓 Professional', documents: '📄 Documents', lifecycle: '📋 History' };

export default function Profile() {
  const { user, apiCall } = useAuth();
  const [tab, setTab] = useState('personal');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Personal fields
  const [name, setName] = useState(''); const [dob, setDob] = useState(''); const [gender, setGender] = useState(''); const [marital, setMarital] = useState(''); const [nationality, setNationality] = useState('');
  // Contact fields
  const [phone, setPhone] = useState(''); const [currentAddr, setCurrentAddr] = useState(''); const [permAddr, setPermAddr] = useState(''); const [ecName, setEcName] = useState(''); const [ecRel, setEcRel] = useState(''); const [ecPhone, setEcPhone] = useState('');
  // Bank fields
  const [acctName, setAcctName] = useState(''); const [acctNum, setAcctNum] = useState(''); const [bankName, setBankName] = useState(''); const [ifsc, setIfsc] = useState(''); const [pan, setPan] = useState(''); const [aadhaar, setAadhaar] = useState('');
  // Professional fields
  const [skills, setSkills] = useState(''); const [education, setEducation] = useState(''); const [experience, setExperience] = useState(''); const [certs, setCerts] = useState('');
  // Document fields
  const [docName, setDocName] = useState(''); const [docUrl, setDocUrl] = useState(''); const [docType, setDocType] = useState('ID Proof');

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await apiCall(`/employees/${user._id}`);
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
        setName(d.personal?.name || ''); setDob(d.personal?.dob || ''); setGender(d.personal?.gender || ''); setMarital(d.personal?.maritalStatus || ''); setNationality(d.personal?.nationality || '');
        setPhone(d.contact?.phone || ''); setCurrentAddr(d.contact?.currentAddress || ''); setPermAddr(d.contact?.permanentAddress || '');
        setEcName(d.contact?.emergencyContact?.name || ''); setEcRel(d.contact?.emergencyContact?.relation || ''); setEcPhone(d.contact?.emergencyContact?.phone || '');
        setAcctName(d.bank?.accountName || ''); setAcctNum(d.bank?.accountNumber || ''); setBankName(d.bank?.bankName || ''); setIfsc(d.bank?.ifscCode || ''); setPan(d.bank?.panNumber || ''); setAadhaar(d.bank?.aadhaarNumber || '');
        const prof = d.professional || {};
        setSkills((prof.skills || []).join(', ')); setEducation(JSON.stringify(prof.education || [])); setExperience(JSON.stringify(prof.experience || [])); setCerts((prof.certifications || []).join(', '));
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchProfile(); }, []);

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); }

  async function savePersonal(e) {
    e.preventDefault(); setSaving(true);
    const res = await apiCall(`/employees/${user._id}`, { method: 'PUT', body: { personal: { name, dob, gender, maritalStatus: marital, nationality }, contact: { phone, currentAddress: currentAddr, permanentAddress: permAddr, emergencyContact: { name: ecName, relation: ecRel, phone: ecPhone } } } });
    const d = await res.json();
    if (res.ok) { showMsg(d.message); fetchProfile(); } else showMsg(d.message, 'error');
    setSaving(false);
  }

  async function saveBankDetails(e) {
    e.preventDefault(); setSaving(true);
    const res = await apiCall(`/employees/${user._id}`, { method: 'PUT', body: { bank: { accountName: acctName, accountNumber: acctNum, bankName, ifscCode: ifsc, panNumber: pan, aadhaarNumber: aadhaar } } });
    const d = await res.json();
    if (res.ok) showMsg(d.message + (d.pendingApproval ? ' (Pending HR approval)' : '')); else showMsg(d.message, 'error');
    setSaving(false);
  }

  async function saveProfessional(e) {
    e.preventDefault(); setSaving(true);
    try {
      const body = {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        certifications: certs.split(',').map(s => s.trim()).filter(Boolean),
        education: JSON.parse(education || '[]'),
        experience: JSON.parse(experience || '[]'),
      };
      const res = await apiCall(`/employees/${user._id}/professional`, { method: 'PUT', body });
      const d = await res.json();
      if (res.ok) { showMsg('Professional profile updated!'); fetchProfile(); } else showMsg(d.message, 'error');
    } catch { showMsg('Invalid JSON in education/experience fields', 'error'); }
    setSaving(false);
  }

  async function uploadDocument(e) {
    e.preventDefault(); setSaving(true);
    const res = await apiCall(`/employees/${user._id}/documents`, { method: 'POST', body: { name: docName, fileUrl: docUrl, documentType: docType } });
    const d = await res.json();
    if (res.ok) { showMsg('Document added!'); setDocName(''); setDocUrl(''); fetchProfile(); } else showMsg(d.message, 'error');
    setSaving(false);
  }

  async function deleteDocument(idx) {
    if (!confirm('Delete this document?')) return;
    const res = await apiCall(`/employees/${user._id}/documents/${idx}`, { method: 'DELETE' });
    if (res.ok) { showMsg('Document deleted'); fetchProfile(); }
  }

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading profile...</div>;

  const msgStyle = { padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` };

  const FG = ({ label, children }) => <div className="form-group"><label className="form-label">{label}</label>{children}</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
            {(profile?.personal?.name || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="page-title">{profile?.personal?.name || 'My Profile'}</h1>
            <p style={{ color: '#94a3b8' }}>{profile?.employment?.designation} · {profile?.employment?.department} · {profile?.employeeId}</p>
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(99,102,241,0.15)' : 'none', border: tab === t ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent', color: tab === t ? '#fff' : '#94a3b8', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {msg.text && <div style={msgStyle}>{msg.text}</div>}

      {(tab === 'personal' || tab === 'contact') && (
        <div className="glass-card">
          <form onSubmit={savePersonal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tab === 'personal' && <>
              <h3 style={{ marginBottom: '0.5rem' }}>Personal Information</h3>
              <div className="input-row">
                <FG label="Full Name"><input className="form-input" value={name} onChange={e => setName(e.target.value)} /></FG>
                <FG label="Date of Birth"><input type="date" className="form-input" value={dob} onChange={e => setDob(e.target.value)} /></FG>
              </div>
              <div className="input-row">
                <FG label="Gender"><select className="form-select" value={gender} onChange={e => setGender(e.target.value)}><option>Male</option><option>Female</option><option>Other</option></select></FG>
                <FG label="Marital Status"><select className="form-select" value={marital} onChange={e => setMarital(e.target.value)}><option>Single</option><option>Married</option><option>Divorced</option></select></FG>
              </div>
              <FG label="Nationality"><input className="form-input" value={nationality} onChange={e => setNationality(e.target.value)} /></FG>
            </>}
            {tab === 'contact' && <>
              <h3 style={{ marginBottom: '0.5rem' }}>Contact Details</h3>
              <FG label="Phone"><input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} /></FG>
              <div className="input-row">
                <FG label="Current Address"><textarea className="form-textarea" style={{ height: '70px' }} value={currentAddr} onChange={e => setCurrentAddr(e.target.value)} /></FG>
                <FG label="Permanent Address"><textarea className="form-textarea" style={{ height: '70px' }} value={permAddr} onChange={e => setPermAddr(e.target.value)} /></FG>
              </div>
              <h4 style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>Emergency Contact</h4>
              <div className="input-row-3">
                <FG label="Name"><input className="form-input" value={ecName} onChange={e => setEcName(e.target.value)} /></FG>
                <FG label="Relation"><input className="form-input" value={ecRel} onChange={e => setEcRel(e.target.value)} /></FG>
                <FG label="Phone"><input className="form-input" value={ecPhone} onChange={e => setEcPhone(e.target.value)} /></FG>
              </div>
            </>}
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>
      )}

      {tab === 'bank' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '0.25rem' }}>Bank & Statutory Information</h3>
          <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginBottom: '1rem' }}>⚠️ Changes require HR approval before taking effect.</p>
          <form onSubmit={saveBankDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-row">
              <FG label="Account Name"><input className="form-input" value={acctName} onChange={e => setAcctName(e.target.value)} /></FG>
              <FG label="Account Number"><input className="form-input" value={acctNum} onChange={e => setAcctNum(e.target.value)} /></FG>
            </div>
            <div className="input-row">
              <FG label="Bank Name"><input className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} /></FG>
              <FG label="IFSC Code"><input className="form-input" value={ifsc} onChange={e => setIfsc(e.target.value)} /></FG>
            </div>
            <div className="input-row">
              <FG label="PAN Number"><input className="form-input" value={pan} onChange={e => setPan(e.target.value)} placeholder="ABCDE1234F" /></FG>
              <FG label="Aadhaar Number"><input className="form-input" value={aadhaar} onChange={e => setAadhaar(e.target.value)} placeholder="XXXX XXXX XXXX" /></FG>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit for Approval'}</button>
          </form>
        </div>
      )}

      {tab === 'professional' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>Professional Profile</h3>
          <form onSubmit={saveProfessional} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FG label="Skills (comma-separated)"><input className="form-input" value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, Python" /></FG>
            <FG label="Certifications (comma-separated)"><input className="form-input" value={certs} onChange={e => setCerts(e.target.value)} placeholder="AWS Certified, PMP, CPA" /></FG>
            <FG label="Education (JSON Array)"><textarea className="form-textarea" style={{ height: '80px', fontFamily: 'monospace', fontSize: '0.82rem' }} value={education} onChange={e => setEducation(e.target.value)} placeholder='[{"degree":"B.Tech","institute":"IIT","year":2020}]' /></FG>
            <FG label="Experience (JSON Array)"><textarea className="form-textarea" style={{ height: '80px', fontFamily: 'monospace', fontSize: '0.82rem' }} value={experience} onChange={e => setExperience(e.target.value)} placeholder='[{"company":"Google","role":"SWE","years":2}]' /></FG>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Professional Profile'}</button>
          </form>
        </div>
      )}

      {tab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Add Document</h3>
            <form onSubmit={uploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-row">
                <FG label="Document Name"><input className="form-input" required value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Offer Letter" /></FG>
                <FG label="Type"><select className="form-select" value={docType} onChange={e => setDocType(e.target.value)}><option>ID Proof</option><option>Offer Letter</option><option>Contract</option><option>Certificate</option><option>Other</option></select></FG>
              </div>
              <FG label="File URL"><input className="form-input" required type="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://storage.example.com/file.pdf" /></FG>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Uploading...' : 'Add Document'}</button>
            </form>
          </div>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>My Documents ({(profile?.documents || []).length})</h3>
            {(profile?.documents || []).length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(profile.documents || []).map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '1.25rem' }}>📄</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.documentType} · {new Date(doc.uploadedAt).toLocaleDateString()}</div>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontSize: '0.82rem', textDecoration: 'none' }}>View</a>
                    {user?.role === 'HR/Admin' && (
                      <button onClick={() => deleteDocument(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>🗑</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'lifecycle' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>Employment Lifecycle History</h3>
          {(profile?.lifecycleHistory || []).length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No lifecycle events recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...(profile.lifecycleHistory || [])].reverse().map((ev, i) => (
                <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#818cf8' }}>{ev.eventType}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Effective: {ev.effectiveDate}</span>
                  </div>
                  {ev.notes && <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.3rem' }}>{ev.notes}</div>}
                  {ev.changes && Object.keys(ev.changes).length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                      {Object.entries(ev.changes).map(([k, v]) => (
                        <span key={k} style={{ marginRight: '1rem' }}><strong>{k}:</strong> {v.from || '—'} → {v.to}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
