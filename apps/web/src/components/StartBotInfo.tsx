import { CheckCircle, ExternalLink, MessageCircle, Zap } from "lucide-react";
import { miniApp, hapticFeedback, openTelegramLink } from "@tma.js/sdk-react";

type StartBotInfoProps = {
    botUsername: string;
    isMiniApp: boolean;
}

export function StartBotInfo({
    botUsername,
    isMiniApp
}: StartBotInfoProps) {
    const handleStartClick = () => {
        // Trigger Haptic Feedback for better UX
        if (hapticFeedback) {
            hapticFeedback.impactOccurred('light');
        }

        // Open the automated link
        openTelegramLink(`https://t.me/${botUsername}?start=register`);
        miniApp.close();
    };

    return (
        <div className="flex flex-col min-h-screen bg-base-100 relative font-sans">

            {/* Background Decor (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

            {/* 1. Header & Hero */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 pt-12">
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary blur-3xl rounded-full scale-110 animate-pulse"></div>
                    <img
                        alt="Thinking Emoji"
                        src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.gif"
                        className="w-28 h-28 relative z-10 drop-shadow-2xl transition-transform duration-300 group-hover:scale-110"
                    />
                    {/* Status Badge */}
                    <div className="absolute -bottom-2 -right-2 bg-base-100 rounded-full p-1 shadow-md z-20">
                        <div className="badge badge-warning badge-sm gap-1">
                            Pending
                        </div>
                    </div>
                </div>

                <div className="space-y-2 max-w-xs z-10">
                    <h1 className="text-2xl font-black tracking-tight text-base-content">
                        Registrasi Diperlukan
                    </h1>
                    <p className="text-base-content/60 text-sm leading-relaxed font-medium">
                        Akun Anda belum terdaftar di sistem kami. Lakukan aktivasi singkat di bawah ini.
                    </p>
                </div>
            </div>

            {/* 2. Timeline Instructions (The "Flow") */}
            <div className="px-6 pb-6">
                <div className="bg-base-200/40 backdrop-blur-sm rounded-3xl p-5 border border-base-200 shadow-sm">
                    <h3 className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4">
                        Langkah Aktivasi
                    </h3>

                    <div className="relative space-y-6">
                        {/* Connecting Line */}
                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-base-300" />

                        {/* Step 1 */}
                        <div className="relative flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0 z-10 shadow-lg shadow-primary/20 ring-4 ring-base-100">
                                <MessageCircle size={16} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="font-bold text-sm text-base-content">Buka Chat Bot</p>
                                <p className="text-xs text-base-content/60 mt-0.5">
                                    Tekan tombol di bawah untuk pindah ke chat.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-base-100 border-2 border-primary text-primary flex items-center justify-center shrink-0 z-10 ring-4 ring-base-100">
                                <Zap size={16} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="font-bold text-sm text-base-content">Klik "Start"</p>
                                <p className="text-xs text-base-content/60 mt-0.5">
                                    Di bagian bawah chat, tombol <span className="font-bold text-primary">Start</span> akan muncul. Klik tombol tersebut.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0 z-10 ring-4 ring-base-100">
                                <CheckCircle size={16} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="font-bold text-sm text-base-content">Selesai</p>
                                <p className="text-xs text-base-content/60 mt-0.5">
                                    Kembali ke sini, aplikasi akan otomatis login.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Sticky Action Button */}
            <div className="sticky bottom-0 w-full bg-base-100/80 backdrop-blur-md p-5 border-t border-base-200/50">
                <button
                    onClick={handleStartClick}
                    className="btn btn-primary btn-lg w-full rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group relative overflow-hidden"
                >
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />

                    <span className="font-bold text-lg">🚀 Mulai Registrasi</span>
                    <ExternalLink size={18} className="opacity-70" />
                </button>

                {!isMiniApp && (
                    <div className="mt-3 text-center">
                        <span className="text-[10px] text-base-content/30 uppercase tracking-widest font-bold">
                            Preview Mode
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}