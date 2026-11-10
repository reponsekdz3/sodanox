import React, { useState } from 'react';
import { FileText, Download, Check, FileArchive, FileCode, FileImage, Film } from 'lucide-react';
import { FileAttachment } from '../../types';

interface FileAttachmentCardProps {
  file: FileAttachment;
  isSelf: boolean;
}

export const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({ file, isSelf }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    try {
      if (file.url && file.url !== '#') {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name || 'attachment';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const getIcon = () => {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.zip') || ext.endsWith('.rar') || ext.endsWith('.tar.gz')) {
      return <FileArchive size={20} className={isSelf ? 'text-white' : 'text-[#059669]'} />;
    }
    if (ext.endsWith('.ts') || ext.endsWith('.js') || ext.endsWith('.json') || ext.endsWith('.html') || ext.endsWith('.py')) {
      return <FileCode size={20} className={isSelf ? 'text-white' : 'text-[#059669]'} />;
    }
    if (ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm')) {
      return <Film size={20} className={isSelf ? 'text-white' : 'text-[#059669]'} />;
    }
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp')) {
      return <FileImage size={20} className={isSelf ? 'text-white' : 'text-[#059669]'} />;
    }
    return <FileText size={20} className={isSelf ? 'text-white' : 'text-[#059669]'} />;
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl w-full max-w-xs sm:max-w-sm transition-all ${
        isSelf
          ? 'bg-gradient-to-r from-[#064E3B] to-[#043427] text-white shadow-soft border border-white/20'
          : 'bg-white text-[#022C22] border border-[#D1E2D9] shadow-soft'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSelf ? 'bg-white/20' : 'bg-[#EDF3F0]'
          }`}
        >
          {getIcon()}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold truncate" title={file.name}>
            {file.name}
          </p>
          <span
            className={`text-[11px] font-mono tabular-nums ${
              isSelf ? 'text-white/80' : 'text-[#4B6358]'
            }`}
          >
            {file.size}
          </span>
        </div>
      </div>

      <button
        onClick={handleDownload}
        type="button"
        className={`p-2 rounded-xl transition-all shrink-0 cursor-pointer ${
          isSelf
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-[#EDF3F0] hover:bg-[#D1E2D9] text-[#022C22]'
        }`}
        title={downloaded ? 'Downloaded' : 'Download file'}
      >
        {downloaded ? <Check size={16} className="text-emerald-400" /> : <Download size={16} />}
      </button>
    </div>
  );
};
