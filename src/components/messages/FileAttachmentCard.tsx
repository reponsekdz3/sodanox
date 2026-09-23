import React, { useState } from 'react';
import { FileText, Download, Check, FileArchive, FileCode, FileImage } from 'lucide-react';
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
      return <FileArchive size={20} className={isSelf ? 'text-white' : 'text-[#8FA89B]'} />;
    }
    if (ext.endsWith('.ts') || ext.endsWith('.js') || ext.endsWith('.json') || ext.endsWith('.html')) {
      return <FileCode size={20} className={isSelf ? 'text-white' : 'text-[#8FA89B]'} />;
    }
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp')) {
      return <FileImage size={20} className={isSelf ? 'text-white' : 'text-[#8FA89B]'} />;
    }
    return <FileText size={20} className={isSelf ? 'text-white' : 'text-[#8FA89B]'} />;
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl w-full max-w-xs sm:max-w-sm transition-all ${
        isSelf
          ? 'bg-[#8FA89B] text-white shadow-soft'
          : 'bg-[#FAFAF9] text-[#2D3732] border border-[#E6EDE9] shadow-soft'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSelf ? 'bg-white/20' : 'bg-[#E6EDE9]'
          }`}
        >
          {getIcon()}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium truncate" title={file.name}>
            {file.name}
          </p>
          <span
            className={`text-[11px] tabular-nums ${
              isSelf ? 'text-white/80' : 'text-[#7A8A82]'
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
            : 'bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732]'
        }`}
        title={downloaded ? 'Downloaded' : 'Download file'}
      >
        {downloaded ? <Check size={16} /> : <Download size={16} />}
      </button>
    </div>
  );
};
