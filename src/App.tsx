/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, ChevronRight, Home, Download, AlertCircle, RefreshCw, HardDrive, X, Tag, Check, Filter } from 'lucide-react';

interface S3File {
  key: string;
  name: string;
  size: number;
  lastModified: string;
}

interface S3Folder {
  prefix: string;
  name: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const getFileType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext || '')) {
    return 'document';
  }
  if (['mp4', 'webm', 'ogg'].includes(ext || '')) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg'].includes(ext || '')) {
    return 'audio';
  }
  return 'other';
};

const PreviewContent = ({ file, bucketEndpointUrl }: { file: S3File, bucketEndpointUrl: string }) => {
  const url = `${bucketEndpointUrl}${file.key}`;
  const type = getFileType(file.name);
  
  if (type === 'image') {
    return <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />;
  }
  if (type === 'pdf') {
    return <iframe src={url} className="w-full min-h-[60vh] h-full border-0" title={file.name} />;
  }
  if (type === 'document') {
    const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    return <iframe src={googleDocsUrl} className="w-full min-h-[60vh] h-full border-0" title={file.name} />;
  }
  if (type === 'video') {
    return (
      <video controls className="max-w-full max-h-full">
         <source src={url} />
         Your browser does not support the video tag.
      </video>
    );
  }
  if (type === 'audio') {
    return (
      <audio controls className="w-full max-w-md">
         <source src={url} />
         Your browser does not support the audio element.
      </audio>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4 text-gray-500 py-12">
      <FileText className="w-16 h-16 text-gray-300" />
      <p>Preview not available for this file type.</p>
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <Download className="w-4 h-4" />
        Download File
      </a>
    </div>
  );
};

const FolderLabel = ({ prefix, initialLabel, onSave }: { prefix: string, initialLabel: string, onSave: (prefix: string, label: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialLabel);

  // Update local state when initialLabel changes globally
  useEffect(() => {
    setValue(initialLabel);
  }, [initialLabel]);

  const handleSave = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSave(prefix, value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form 
        onSubmit={handleSave} 
        className="flex items-center gap-1 ml-2"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-xs border border-blue-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="Folder label..."
        />
        <button type="submit" className="text-blue-600 hover:bg-blue-50 p-1 rounded">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button 
          type="button" 
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(false);
            setValue(initialLabel);
          }}
          className="text-gray-400 hover:bg-gray-100 p-1 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div 
      className="flex items-center gap-1 text-xs ml-2 flex-1 min-w-0"
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {initialLabel ? (
        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 hover:bg-blue-100 cursor-pointer font-medium max-w-[200px] truncate" title={initialLabel}>
          <Tag className="w-3 h-3 shrink-0" />
          <span className="truncate">{initialLabel}</span>
        </span>
      ) : (
        <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1 rounded">
          <Tag className="w-3.5 h-3.5" />
          Add Label
        </button>
      )}
    </div>
  );
};

export default function App() {
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [folderLabels, setFolderLabels] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<S3File | null>(null);

  const [filterLabelText, setFilterLabelText] = useState('');
  const [sortByLabel, setSortByLabel] = useState(false);
  
  const previousPrefixRef = useRef<string | null>(null);
  const [returnToPrefix, setReturnToPrefix] = useState<string | null>(null);

  const bucketEndpointUrl = 'https://aws3.unigal.ac.id/ftgenk-storage/';

  // Load labels from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('s3_explorer_labels');
      if (stored) {
        setFolderLabels(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load labels from localStorage', e);
    }
  }, []);

  const handleSetLabel = async (prefix: string, label: string) => {
    const updated = { ...folderLabels };
    if (!label.trim()) {
      delete updated[prefix];
    } else {
      updated[prefix] = label.trim();
    }
    setFolderLabels(updated);

    try {
      localStorage.setItem('s3_explorer_labels', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save label to localStorage', e);
    }
  };

  const fetchContents = async (prefix: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://aws3.unigal.ac.id/ftgenk-storage/?list-type=2&prefix=${encodeURIComponent(prefix)}&delimiter=/`;
      const response = await fetch(url);
      const contentType = response.headers.get('content-type');
      const xmlText = await response.text();
      
      if (!response.ok) {
        throw new Error(`Failed to fetch S3 data: ${response.status} ${response.statusText}\n${xmlText.slice(0, 100)}`);
      }
      
      if (!contentType || (!contentType.includes('text/xml') && !contentType.includes('application/xml'))) {
        console.error('Expected XML but got:', xmlText.slice(0, 100));
        throw new Error('Server returned HTML instead of XML. This usually means the API route was not found and fell back to the main page.');
      }
      
      const parser = new DOMParser();
      // Handle parsing correctly and defensively
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
          throw new Error('Failed to parse XML response from S3.');
      }
      
      // Check for S3 Error response `<Error><Code>...</Code><Message>...</Message></Error>`
      const errorNode = xmlDoc.getElementsByTagName('Error')[0];
      if (errorNode) {
        const msg = errorNode.getElementsByTagName('Message')[0]?.textContent || 'Unknown S3 error';
        throw new Error(msg);
      }

      const parsedFolders: S3Folder[] = [];
      const commonPrefixes = xmlDoc.getElementsByTagName('CommonPrefixes');
      for (let i = 0; i < commonPrefixes.length; i++) {
        const p = commonPrefixes[i].getElementsByTagName('Prefix')[0]?.textContent;
        if (p) {
          // Extract just the folder name
          const name = p.substring(prefix.length).replace(/\/$/, '');
          parsedFolders.push({ prefix: p, name });
        }
      }

      const parsedFiles: S3File[] = [];
      const contentsList = xmlDoc.getElementsByTagName('Contents');
      for (let i = 0; i < contentsList.length; i++) {
        const keyNode = contentsList[i].getElementsByTagName('Key')[0];
        const key = keyNode?.textContent;
        
        if (!key) continue;
        
        const sizeString = contentsList[i].getElementsByTagName('Size')[0]?.textContent || '0';
        const size = parseInt(sizeString, 10);
        const lastModified = contentsList[i].getElementsByTagName('LastModified')[0]?.textContent || '';

        // Only include if it's not the directory object itself and isn't a subfolder object (which has a trailing slash)
        if (!key.endsWith('/')) {
          const name = key.substring(prefix.length);
          if (name.length > 0 && !name.includes('/')) {
            parsedFiles.push({ key, name, size, lastModified });
          }
        }
      }

      setFolders(parsedFolders);
      setFiles(parsedFiles);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (previousPrefixRef.current !== null && previousPrefixRef.current !== currentPrefix) {
      if (previousPrefixRef.current.startsWith(currentPrefix)) {
        const relPath = previousPrefixRef.current.substring(currentPrefix.length);
        const childFolderName = relPath.split('/')[0];
        const childPrefix = currentPrefix + childFolderName + '/';
        setReturnToPrefix(childPrefix);
      } else {
        setReturnToPrefix(null);
      }
    } else {
      setReturnToPrefix(null);
    }
    previousPrefixRef.current = currentPrefix;
    fetchContents(currentPrefix);
  }, [currentPrefix]);

  useEffect(() => {
    if (!loading && returnToPrefix) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`folder-${returnToPrefix}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.backgroundColor = '#eff6ff'; // blue-50 equivalent
          el.style.transition = 'background-color 2s ease-out';
          setTimeout(() => {
            el.style.backgroundColor = '';
          }, 2000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, returnToPrefix]);

  const breadcrumbParts = currentPrefix.split('/').filter(Boolean);

  let displayFolders = folders;
  if (filterLabelText) {
    const lowerFilter = filterLabelText.toLowerCase();
    displayFolders = displayFolders.filter(f => {
      const lbl = folderLabels[f.prefix] || '';
      return lbl.toLowerCase().includes(lowerFilter);
    });
  }

  if (sortByLabel) {
    displayFolders = [...displayFolders].sort((a, b) => {
      const lblA = folderLabels[a.prefix]?.toLowerCase() || '';
      const lblB = folderLabels[b.prefix]?.toLowerCase() || '';
      if (lblA && !lblB) return -1;
      if (!lblA && lblB) return 1;
      return lblA.localeCompare(lblB);
    });
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPrefix(''); // home
      return;
    }
    const newPrefix = breadcrumbParts.slice(0, index + 1).join('/') + '/';
    setCurrentPrefix(newPrefix);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">
                S3 Storage Explorer
              </h1>
              <p className="text-sm font-medium text-gray-500 truncate max-w-xs sm:max-w-md">
                aws3.unigal.ac.id/ftgenk-storage
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchContents(currentPrefix)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Breadcrumbs Navigation */}
        <div className="bg-white p-3 md:px-5 md:py-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => handleBreadcrumbClick(-1)}
            className={`flex items-center gap-1.5 transition-colors focus:outline-none ${
              breadcrumbParts.length === 0 ? 'text-gray-800 font-medium cursor-default' : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Bucket Root</span>
          </button>
          
          {breadcrumbParts.map((part, index) => {
            const isLast = index === breadcrumbParts.length - 1;
            return (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1 shrink-0" />
                <button
                  onClick={() => !isLast && handleBreadcrumbClick(index)}
                  className={`flex items-center gap-1.5 focus:outline-none transition-colors ${
                    isLast ? 'text-gray-800 font-medium cursor-default' : 'text-gray-500 hover:text-blue-600'
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error loading contents</h3>
              <p className="text-sm mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {/* Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
               <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input 
                  type="text" 
                  placeholder="Filter by label..." 
                  value={filterLabelText}
                  onChange={(e) => setFilterLabelText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
               />
            </div>
            <button 
              onClick={() => setSortByLabel(!sortByLabel)}
              className={`px-3 py-2 text-sm font-medium border rounded-lg flex items-center gap-2 transition-colors shrink-0 ${sortByLabel ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Sort by Label
            </button>
          </div>
        </div>

        {/* Content Table Container */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-12 md:col-span-7">Name</div>
            <div className="hidden md:block col-span-3">Last Modified</div>
            <div className="hidden md:block col-span-2 text-right">Size</div>
          </div>

          {/* Loading Skeleton Space */}
          {loading && folders.length === 0 && files.length === 0 ? (
            <div className="px-6 py-12 flex justify-center items-center">
               <div className="flex flex-col items-center text-gray-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-sm font-medium">Loading contents...</span>
               </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              
              {/* Empty State */}
              {!loading && displayFolders.length === 0 && files.length === 0 && !error && (
                 <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                      <HardDrive className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {folders.length > 0 ? "No results found" : "Directory is empty"}
                    </h3>
                    <p className="text-gray-500 text-sm max-w-sm">
                      {folders.length > 0 ? "Try adjusting your filter." : "There are no files or folders located at this path."}
                    </p>
                 </div>
              )}

              {/* Folders */}
              {displayFolders.map((folder, index) => (
                <div 
                  id={`folder-${folder.prefix}`}
                  key={`folder-${index}`}
                  onClick={() => setCurrentPrefix(folder.prefix)}
                  className="grid grid-cols-12 gap-4 px-6 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors items-center group"
                >
                  <div className="col-span-12 md:col-span-7 flex items-center gap-3 min-w-0">
                    <Folder className="w-5 h-5 text-blue-500 fill-blue-500/20 shrink-0" />
                    <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors truncate shrink-0">
                      {folder.name}
                    </span>
                    <FolderLabel 
                      prefix={folder.prefix} 
                      initialLabel={folderLabels[folder.prefix] || ''} 
                      onSave={handleSetLabel} 
                    />
                  </div>
                  <div className="hidden md:block col-span-3 text-sm text-gray-400">
                    --
                  </div>
                  <div className="hidden md:block col-span-2 text-sm text-gray-400 text-right">
                    --
                  </div>
                </div>
              ))}

              {/* Files */}
              {files.map((file, index) => (
                <div 
                  key={`file-${index}`}
                  onClick={() => setPreviewFile(file)}
                  className="grid grid-cols-12 gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors items-center group cursor-pointer"
                >
                  <div className="col-span-12 md:col-span-7 flex items-center justify-between md:justify-start gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden flex-1">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-700 truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    {/* Action buttons on mobile logic */}
                    <div className="md:hidden shrink-0">
                      <a 
                        href={`${bucketEndpointUrl}${file.key}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full flex items-center justify-center transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="hidden md:block col-span-3 text-sm text-gray-500 truncate" title={new Date(file.lastModified).toLocaleString()}>
                    {file.lastModified ? new Date(file.lastModified).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '--'}
                  </div>
                  
                  <div className="hidden md:flex col-span-2 text-sm text-gray-500 justify-end items-center gap-4">
                    <span className="truncate">{formatBytes(file.size)}</span>
                    <a 
                      href={`${bucketEndpointUrl}${file.key}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-all focus:opacity-100"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-medium text-gray-900 truncate pr-4">{previewFile.name}</h3>
              <div className="flex relative items-center gap-2">
                <a
                  href={`${bucketEndpointUrl}${previewFile.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-gray-100 min-h-[50vh] flex items-center justify-center relative">
               <PreviewContent file={previewFile} bucketEndpointUrl={bucketEndpointUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

