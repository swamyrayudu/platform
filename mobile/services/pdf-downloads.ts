// Resource PDFs downloaded for offline reading, inside the app only.
// The files live in the app's private document folder: other apps, the Files
// app and the gallery cannot see them, they cannot be shared, and they go when
// the app is uninstalled. They open only in the app's viewer (/pdf/[id]),
// which blocks screenshots. The list of downloads is kept in the encrypted vault.
import { Directory, File, Paths } from 'expo-file-system';
import { vault } from './vault';
import { resourcesService } from './learning-service';

export interface DownloadedPdf { id: string; title: string; size_bytes: number; access: 'free' | 'pro'; downloaded_at: string }

const LIST = 'resources.downloads';
const folder = () => new Directory(Paths.document, 'resource-pdfs');
const safeId = (id: string) => { if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Unknown resource.'); return id; };
export const downloadedFile = (id: string) => new File(folder(), `${safeId(id)}.pdf`);

async function list(): Promise<DownloadedPdf[]> {
  try { return (await vault.read<DownloadedPdf[]>(LIST)) ?? []; } catch { return []; }
}

export const pdfDownloads = {
  /** Downloads whose file is still on the phone. */
  async list(): Promise<DownloadedPdf[]> {
    return (await list()).filter(d => { try { return downloadedFile(d.id).exists; } catch { return false; } });
  },
  has(id: string) { try { return downloadedFile(id).exists; } catch { return false; } },
  async download(resource: Omit<DownloadedPdf, 'downloaded_at'>) {
    const dir = folder();
    if (!dir.exists) dir.create({intermediates: true, idempotent: true});
    const {url} = await resourcesService.link(resource.id);
    const target = downloadedFile(resource.id);
    await File.downloadFileAsync(url, target, {idempotent: true});
    const others = (await list()).filter(d => d.id !== resource.id);
    await vault.write(LIST, [{...resource, downloaded_at: new Date().toISOString()}, ...others]);
  },
  async remove(id: string) {
    try { const file = downloadedFile(id); if (file.exists) file.delete(); } catch { /* Already gone. */ }
    await vault.write(LIST, (await list()).filter(d => d.id !== id));
  },
};
