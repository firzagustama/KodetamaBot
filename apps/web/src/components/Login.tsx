import { Button } from "@telegram-apps/telegram-ui";

interface LoginProps {
    isMiniApp: boolean;
    botUsername: string;
    onTelegramAuth: (user: any) => Promise<void>;
    error?: string | null;
    isLoading?: boolean;
}

export function Login({
    isMiniApp,
    botUsername,
    onTelegramAuth,
    error,
    isLoading
}: LoginProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-base-200">
            <div className="bg-base-100 rounded-2xl shadow-xl p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">💰</div>
                    <h1 className="text-2xl font-bold text-base-content">Kodetama Finance</h1>
                    <p className="text-base-content text-opacity-70 text-sm mt-2">
                        Kelola keuangan Anda dengan mudah
                    </p>
                </div>

                {error && (
                    <div className="alert alert-error mb-4">
                        <span>❌</span>
                        <span>{error}</span>
                    </div>
                )}

                {!isMiniApp && !error && (
                    <div className="alert alert-info mb-4">
                        <span>ℹ️</span>
                        <span>
                            Anda juga bisa membuka aplikasi ini dari bot Telegram untuk pengalaman yang lebih baik.
                        </span>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="text-center">
                        <div className="text-sm text-base-content text-opacity-80 mb-4">
                            Login dengan akun Telegram Anda:
                        </div>
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <div className="loading loading-spinner loading-md"></div>
                                <p className="text-sm text-base-content text-opacity-70">Memproses login...</p>
                            </div>
                        ) : (
                            <TelegramLoginButton
                                botName={botUsername}
                                buttonSize="large"
                                cornerRadius={10}
                                requestAccess={true}
                                usePic={true}
                                lang="en"
                                onAuth={onTelegramAuth}
                            />
                        )}
                    </div>

                    <div className="divider">atau</div>

                    <div className="card card-compact bg-base-200">
                        <div className="card-body text-center">
                            <div className="text-sm text-base-content text-opacity-80 mb-2">
                                Gunakan di Telegram Mini App
                            </div>
                            <a
                                href={`https://t.me/${botUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm"
                            >
                                <span>Buka Bot</span>
                                <span>→</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-xs text-base-content text-opacity-50">
                        Dengan login, Anda menyetujui penggunaan data Telegram Anda
                    </p>
                </div>
            </div>
        </div>
    );
}

// Telegram Login Button Component - simplified version
interface TelegramLoginButtonProps {
    botName: string;
    buttonSize?: 'large' | 'medium' | 'small';
    cornerRadius?: number;
    requestAccess?: boolean;
    usePic?: boolean;
    lang?: string;
    onAuth: (user: any) => Promise<void>;
}

function TelegramLoginButton({
    botName,
    requestAccess = true,
    usePic = true,
    lang = 'en',
}: TelegramLoginButtonProps) {
    const script = document.querySelector('script[src*="telegram-widget"]');
    if (!script) {
        const newScript = document.createElement('script');
        newScript.src = 'https://telegram.org/js/telegram-widget.js?22';
        newScript.async = true;
        document.head.appendChild(newScript);
    }

    return (
        <div
            dangerouslySetInnerHTML={{
                __html: `
                    <script async src="https://telegram.org/js/telegram-widget.js?22"
                        data-telegram-login="${botName}"
                        data-size="large"
                        data-radius="10"
                        ${requestAccess ? 'data-request-access="write"' : ''}
                        ${usePic ? 'data-userpic="true"' : ''}
                        data-lang="${lang}"
                        data-auth-url="${window.location.origin}/auth/telegram-widget-callback">
                        Login With Telegram
                    </script>
                `
            }}
        />
    );
}