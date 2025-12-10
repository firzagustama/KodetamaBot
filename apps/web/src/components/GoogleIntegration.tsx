import { useStore } from "../stores/useStore";
import { useEffect, useState } from "react";
import { hapticFeedback } from "@tma.js/sdk-react";
import {
    FileSpreadsheet,
    FolderOpen,
    RefreshCw,
    CheckCircle2,
    XCircle,
    FlaskConical,
    ExternalLink,
    Construction,
    ArrowLeft
} from "lucide-react";

// --- PART 1: The "Coming Soon" Page Component ---
// Use this whenever you need a placeholder for an unimplemented feature
function ComingSoonView({ onBack, title = "Segera Hadir" }: { onBack: () => void, title?: string }) {
    return (
        <div className="fixed inset-0 z-50 bg-base-100 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center p-4 border-b border-base-200">
                <button
                    onClick={onBack}
                    className="btn btn-circle btn-ghost btn-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="ml-2 font-bold text-lg">{title}</h2>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center relative">
                    <Construction size={48} className="text-primary" />
                    <div className="absolute top-0 right-0 w-6 h-6 bg-warning rounded-full animate-ping"></div>
                </div>

                <div className="space-y-2 max-w-xs">
                    <h3 className="text-2xl font-bold text-base-content">
                        Sedang Dikerjakan
                    </h3>
                    <p className="text-base-content/60 text-sm leading-relaxed">
                        Fitur ini sedang dalam tahap pengembangan akhir. Kami akan memberitahu Anda saat fitur ini siap!
                    </p>
                </div>

                <div className="w-full max-w-xs bg-base-200 rounded-xl p-4 text-xs text-left space-y-3">
                    <p className="font-bold text-base-content/50 uppercase tracking-wider">Timeline</p>
                    <div className="flex gap-3 items-center opacity-50">
                        <CheckCircle2 size={16} className="text-success" />
                        <span className="line-through">Desain UI/UX</span>
                    </div>
                    <div className="flex gap-3 items-center opacity-50">
                        <CheckCircle2 size={16} className="text-success" />
                        <span className="line-through">Backend Integration</span>
                    </div>
                    <div className="flex gap-3 items-center font-medium text-primary">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Testing & Release</span>
                    </div>
                </div>

                <button onClick={onBack} className="btn btn-primary w-full max-w-xs rounded-xl mt-4">
                    Mengerti
                </button>
            </div>
        </div>
    );
}

// --- PART 2: The Main Google Integration Page ---
export default function GoogleIntegration() {
    const { googleSheet, googleFolder, fetchGoogleData } = useStore();
    const [showComingSoon, setShowComingSoon] = useState(false);

    useEffect(() => {
        fetchGoogleData();
    }, []);

    // Logic to handle "Connect" click
    const handleConnectClick = () => {
        // Since logic isn't ready, we show the Coming Soon page
        if (hapticFeedback) {
            hapticFeedback.notificationOccurred('warning');
        }
        setShowComingSoon(true);
    };

    // If the "Coming Soon" state is active, render that page instead
    if (showComingSoon) {
        return <ComingSoonView onBack={() => setShowComingSoon(false)} title="Integrasi Google" />;
    }

    return (
        <div className="space-y-6 pb-6 animate-fade-in relative">

            {/* Header Section */}
            <div className="px-1">
                <h2 className="text-lg font-bold">Sinkronisasi Data</h2>
                <p className="text-xs text-base-content/60">
                    Hubungkan akun Google untuk backup otomatis.
                </p>
            </div>

            {/* 1. Google Sheets Card */}
            <div className="relative overflow-hidden bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5">
                {/* <div className="absolute top-0 right-0 p-4 opacity-10">
                    <FileSpreadsheet size={80} />
                </div> */}

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base-content">Google Sheets</h3>
                            <p className="text-xs text-base-content/50">Export real-time database</p>
                        </div>
                    </div>

                    {googleSheet?.spreadsheetUrl ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-base-content/60 bg-base-200/50 p-2 rounded-lg">
                                <RefreshCw size={12} />
                                <span>
                                    Synced: {googleSheet.lastSyncAt
                                        ? new Date(googleSheet.lastSyncAt).toLocaleString("id-ID")
                                        : "Baru saja"}
                                </span>
                            </div>
                            <a
                                href={googleSheet.spreadsheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-success w-full rounded-xl text-white shadow-lg shadow-success/20 gap-2"
                            >
                                <ExternalLink size={16} /> Buka Spreadsheet
                            </a>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnectClick}
                            className="btn btn-sm bg-base-200 border-none text-base-content hover:bg-base-300 w-full rounded-xl"
                        >
                            Hubungkan Akun
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Google Drive Card */}
            <div className="relative overflow-hidden bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5">
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                            <FolderOpen size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base-content">Google Drive</h3>
                            <p className="text-xs text-base-content/50">Penyimpanan Invoice & Bukti</p>
                        </div>
                    </div>

                    {googleFolder?.folderUrl ? (
                        <a
                            href={googleFolder.folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-warning w-full rounded-xl text-white shadow-lg shadow-warning/20 gap-2"
                        >
                            <ExternalLink size={16} /> Buka Folder
                        </a>
                    ) : (
                        <div className="text-xs text-center bg-base-200/50 p-3 rounded-xl text-base-content/60">
                            Folder akan otomatis dibuat saat Anda mengupload invoice pertama via Bot.
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Sync Status Check */}
            <div className="bg-base-100 rounded-3xl border border-base-200 p-5">
                <h4 className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-4">
                    Status Koneksi
                </h4>
                <div className="space-y-4">
                    <StatusRow
                        label="Spreadsheet API"
                        isConnected={!!googleSheet?.spreadsheetUrl}
                    />
                    <StatusRow
                        label="Drive Storage"
                        isConnected={!!googleFolder?.folderUrl}
                    />
                </div>
            </div>

            {/* 4. Beta Test Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 p-5 text-white shadow-xl shadow-blue-500/20">

                {/* Background Decor (Optional) */}
                <div className="absolute -bottom-6 -right-6 text-white/10 rotate-12 pointer-events-none">
                    <FlaskConical size={100} />
                </div>

                <div className="flex items-start gap-4 relative z-10">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <FlaskConical size={20} className="text-cyan-200" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-sm">Akses Beta Tester</h4>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">
                                v0.9
                            </span>
                        </div>
                        <p className="text-xs text-blue-50 leading-relaxed">
                            Fitur ini masih dalam tahap uji coba. Bantu kami berkembang dengan melaporkan kendala yang Anda temui.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// const proBanner = () => {
//     {/* 4. Pro Banner */ }
//     <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-xl shadow-indigo-500/20">
//         <div className="flex items-start gap-4 relative z-10">
//             <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
//                 <Crown size={20} className="text-yellow-300" />
//             </div>
//             <div className="flex-1">
//                 <h4 className="font-bold text-sm">Upgrade ke Pro</h4>
//                 <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
//                     Dapatkan fitur upload voice note dan scan struk otomatis dengan AI.
//                 </p>
//             </div>
//         </div>
//     </div>
// }

// --- Helper Component ---
function StatusRow({ label, isConnected }: { label: string, isConnected: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-content">{label}</span>
            <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md ${isConnected ? "bg-success/10 text-success" : "bg-base-200 text-base-content/40"
                }`}>
                {isConnected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {isConnected ? "Aktif" : "Terputus"}
            </div>
        </div>
    );
}