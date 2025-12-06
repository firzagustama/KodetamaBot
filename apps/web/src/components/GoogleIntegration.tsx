import { useStore } from "../stores/useStore";
import { useEffect } from "react";

export default function GoogleIntegration() {
    const { googleSheet, googleFolder, fetchGoogleData } = useStore();

    useEffect(() => {
        fetchGoogleData();
    }, []);

    return (
        <div className="space-y-4">
            {/* Google Sheets Card */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold">Google Sheets</h3>
                        <p className="text-sm text-slate-500">
                            Export transaksi ke spreadsheet
                        </p>
                    </div>
                </div>

                {googleSheet?.spreadsheetUrl ? (
                    <div className="mt-4 space-y-2">
                        <a
                            href={googleSheet.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-2.5 text-center bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors"
                        >
                            Buka Spreadsheet
                        </a>
                        {googleSheet.lastSyncAt && (
                            <p className="text-xs text-center text-slate-400">
                                Terakhir sync: {new Date(googleSheet.lastSyncAt).toLocaleString("id-ID")}
                            </p>
                        )}
                    </div>
                ) : (
                    <button
                        className="mt-4 w-full py-2.5 text-center bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                        onClick={() => {
                            // TODO: Connect Google account
                            alert("Fitur Google Sheets akan segera hadir!");
                        }}
                    >
                        Hubungkan Google
                    </button>
                )}
            </div>

            {/* Google Drive Card */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                        <span className="text-2xl">📁</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold">Google Drive</h3>
                        <p className="text-sm text-slate-500">
                            Folder invoice untuk periode ini
                        </p>
                    </div>
                </div>

                {googleFolder?.folderUrl ? (
                    <a
                        href={googleFolder.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block w-full py-2.5 text-center bg-yellow-500 text-white font-medium rounded-xl hover:bg-yellow-600 transition-colors"
                    >
                        Buka Folder Invoice
                    </a>
                ) : (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-sm text-slate-500">
                            Upload invoice via bot untuk membuat folder
                        </p>
                    </div>
                )}
            </div>

            {/* Sync Status */}
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-4 border border-blue-100">
                <h4 className="font-medium text-blue-700 flex items-center gap-2">
                    🔄 Status Sinkronisasi
                </h4>
                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-600">Google Sheets</span>
                        <span className={googleSheet ? "text-success" : "text-slate-400"}>
                            {googleSheet ? "✓ Terhubung" : "Belum terhubung"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Google Drive</span>
                        <span className={googleFolder ? "text-success" : "text-slate-400"}>
                            {googleFolder ? "✓ Terhubung" : "Belum terhubung"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Pro Tier Feature Note */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                <h4 className="font-medium text-purple-700">⭐ Fitur Pro</h4>
                <p className="text-sm text-slate-600 mt-2">
                    Upload invoice dan voice note tersedia untuk tier Pro.
                    Upgrade untuk akses fitur lengkap!
                </p>
            </div>
        </div>
    );
}
