import { useLocation, useNavigate } from 'react-router-dom';

export function BottomNavigation() {
    const location = useLocation();
    const navigate = useNavigate();

    const tabs = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/budget', label: 'Budget', icon: '🎯' },
        { path: '/transactions', label: 'Transaksi', icon: '📋' },
        { path: '/google', label: 'Google', icon: '🔗' },
    ];

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            backgroundColor: 'var(--tgui--bg_color)',
            borderTop: '1px solid var(--tgui--separator_color)',
            paddingBottom: '20px',
            paddingTop: '10px',
            zIndex: 10
        }}>
            {tabs.map((tab) => {
                const isActive = location.pathname === tab.path;
                return (
                    <button
                        key={tab.path}
                        onClick={() => navigate(tab.path)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: isActive ? 'var(--tgui--link_color)' : 'var(--tgui--text_color)',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                        <span style={{ fontSize: '11px' }}>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}