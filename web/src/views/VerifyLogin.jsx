import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyLoginToken } from '../services/auth';
import { useUserSession } from '../hooks/useUserSession';

function VerifyLogin() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useUserSession();
  const navigate = useNavigate();
  const location = useLocation();
  const verifierCalled = useRef(false);

  useEffect(() => {
    // Prevent double verification in React StrictMode
    if (verifierCalled.current) return;
    
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    // Immediately sanitize the URL query parameter to protect security/privacy
    if (token) {
      verifierCalled.current = true;
      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete('token');
      const searchStr = cleanParams.toString();
      const newPath = window.location.pathname + (searchStr ? `?${searchStr}` : '') + window.location.hash;
      window.history.replaceState(null, '', newPath);

      const verify = async () => {
        try {
          const user = await verifyLoginToken(token);
          setStatus('success');
          login(user);
          // Redirect to dashboard after a short delay so the user sees the success state
          setTimeout(() => {
            navigate('/trips');
          }, 1500);
        } catch (err) {
          console.error('Verification error:', err);
          setStatus('error');
          setErrorMessage(err.message || 'Verification failed. The link may be invalid or expired.');
        }
      };

      verify();
    } else {
      setStatus('error');
      setErrorMessage('No verification token was found in the link.');
    }
  }, [location, login, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg, #0f172a)',
      color: 'var(--color-fg, #f8fafc)',
      fontFamily: 'Inter, sans-serif',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        backgroundColor: 'var(--color-card-bg, #1e293b)',
        padding: '2.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--color-border, #334155)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        {status === 'loading' && (
          <>
            <div className="spinner" style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '4px solid var(--color-primary-light, #38bdf8)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0' }}>Verifying your link</h2>
            <p style={{ color: 'var(--color-fg-muted, #94a3b8)', margin: '0', fontSize: '0.95rem' }}>
              Checking your login credentials. Please hold on...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              fontSize: '2rem',
              fontWeight: 'bold'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0', color: '#22c55e' }}>Login Successful!</h2>
            <p style={{ color: 'var(--color-fg-muted, #94a3b8)', margin: '0', fontSize: '0.95rem' }}>
              Redirecting you to the trips dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              fontSize: '2rem',
              fontWeight: 'bold'
            }}>
              !
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0', color: '#ef4444' }}>Verification Failed</h2>
            <p style={{ color: 'var(--color-fg-muted, #94a3b8)', margin: '0', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/trips')}
              style={{
                marginTop: '1rem',
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-primary, #0ea5e9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover, #0284c7)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'var(--color-primary, #0ea5e9)'}
            >
              Back to Splash Screen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyLogin;
