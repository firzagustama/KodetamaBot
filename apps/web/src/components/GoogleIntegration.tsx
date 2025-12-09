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
                    <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold">Google Sheets</h3>
                        <p className="text-sm text-base-content/70">
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
                            className="block w-full py-2.5 text-center bg-success text-success-content font-medium rounded-xl hover:bg-success-focus transition-colors"
                        >
                            Buka Spreadsheet
                        </a>
                        {googleSheet.lastSyncAt && (
                            <p className="text-xs text-center text-base-content/60">
                                Terakhir sync: {new Date(googleSheet.lastSyncAt).toLocaleString("id-ID")}
                            </p>
                        )}
                    </div>
                ) : (
                    <button
                        className="mt-4 w-full py-2.5 text-center bg-base-200 text-base-content font-medium rounded-xl hover:bg-base-300 transition-colors"
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
                    <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                        <span className="text-2xl">📁</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold">Google Drive</h3>
                        <p className="text-sm text-base-content/70">
                            Folder invoice untuk periode ini
                        </p>
                    </div>
                </div>

                {googleFolder?.folderUrl ? (
                    <a
                        href={googleFolder.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block w-full py-2.5 text-center bg-warning text-warning-content font-medium rounded-xl hover:bg-warning-focus transition-colors"
                    >
                        Buka Folder Invoice
                    </a>
                ) : (
                    <div className="mt-4 p-3 bg-base-200 rounded-xl text-center">
                        <p className="text-sm text-base-content/70">
                            Upload invoice via bot untuk membuat folder
                        </p>
                    </div>
                )}
            </div>

            {/* Sync Status */}
            <div className="bg-info/10 rounded-2xl p-4 border border-info/20">
                <h4 className="font-medium text-info flex items-center gap-2">
                    🔄 Status Sinkronisasi
                </h4>
                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-base-content">Google Sheets</span>
                        <span className={googleSheet ? "text-success" : "text-base-content/60"}>
                            {googleSheet ? "✓ Terhubung" : "Belum terhubung"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-base-content">Google Drive</span>
                        <span className={googleFolder ? "text-success" : "text-base-content/60"}>
                            {googleFolder ? "✓ Terhubung" : "Belum terhubung"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Pro Tier Feature Note */}
            <div className="bg-secondary/10 rounded-2xl p-4 border border-secondary/20">
                <h4 className="font-medium text-secondary-focus">⭐ Fitur Pro</h4>
                <p className="text-sm text-base-content/80 mt-2">
                    Upload invoice dan voice note tersedia untuk tier Pro.
                    Upgrade untuk akses fitur lengkap!
                </p>
            </div>
        </div>
    );
}