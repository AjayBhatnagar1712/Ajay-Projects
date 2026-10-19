'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FileUp, Crop as CropIcon, LoaderCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

// Set up pdfjs worker from an external CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfQuestionExtractorProps {
  onImageCropped: (data: { imageUrl: string; extractedText?: string }) => void | Promise<void>;
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  pageNumber: number;
  onPageNumberChange: (page: number) => void;
  enableTextExtraction?: boolean;
  accept?: string;
}

export default function PdfQuestionExtractor({ 
    onImageCropped, 
    title, 
    description,
    file,
    onFileChange,
    pageNumber,
    onPageNumberChange,
    enableTextExtraction = false,
    accept = 'application/pdf,image/*',
}: PdfQuestionExtractorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageImgSrc, setPageImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [pageInput, setPageInput] = useState(String(pageNumber));
  const [pdfDocumentUrl, setPdfDocumentUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    const newFile = files?.[0] || null;
    if (newFile && !(newFile.type === 'application/pdf' || newFile.type.startsWith('image/'))) {
      toast({
        variant: 'destructive',
        title: 'Unsupported file',
        description: 'Please upload a PDF or image file for cropping.',
      });
      onFileChange(null);
      setNumPages(null);
      onPageNumberChange(1);
      setPageImgSrc('');
      setCrop(undefined);
      setCompletedCrop(undefined);
      event.target.value = '';
      return;
    }

    onFileChange(newFile);
    
    setNumPages(null);
    onPageNumberChange(1);
    setPageImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
  };
  
  useEffect(() => {
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setNumPages(null);
      onPageNumberChange(1);
      setPageImgSrc('');
      setCrop(undefined);
      setCompletedCrop(undefined);
      setPageInput('1');
    }
  }, [file, onPageNumberChange]);

  useEffect(() => {
    if (!file || file.type !== 'application/pdf') {
      setPdfDocumentUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPdfDocumentUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  useEffect(() => {
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPageImgSrc(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.onerror = () => {
        setPageImgSrc('');
        toast({
          variant: 'destructive',
          title: 'Image Load Error',
          description: 'Unable to preview this image file.',
        });
      };
      reader.readAsDataURL(file);
      setIsRendering(false);
      setNumPages(null);
      return () => {
        if (reader.readyState === FileReader.LOADING) {
          reader.abort();
        }
      };
    }

    setPageImgSrc('');
    setIsRendering(true);
  }, [file, pageNumber, toast]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const onPageRenderSuccess = useCallback(() => {
    if (pdfContainerRef.current) {
        const canvas = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (canvas) {
            setPageImgSrc(canvas.toDataURL());
        }
    }
    setIsRendering(false);
  }, []);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const x = Math.max(0, Math.round(width * 0.05));
    const y = Math.max(0, Math.round(height * 0.05));
    const cropWidth = Math.max(1, Math.round(width * 0.9));
    const cropHeight = Math.max(1, Math.round(height * 0.9));
    setCrop({ unit: 'px', x, y, width: cropWidth, height: cropHeight });
  }

  async function handleConfirmCrop() {
    if (!completedCrop || !imgRef.current) {
      toast({
        variant: 'destructive',
        title: 'No Crop',
        description: 'Please select an area of the image to use.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const croppedDataUrl = await getCroppedImg(imgRef.current, completedCrop);
      let extractedText: string | undefined;

      if (enableTextExtraction && file && file.type === 'application/pdf' && pdfDocumentUrl) {
        extractedText = await extractTextFromCrop(pdfDocumentUrl, pageNumber, imgRef.current, completedCrop);
      }
      
      await onImageCropped({ 
          imageUrl: croppedDataUrl,
          extractedText,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Crop Failed',
        description: error?.message || 'Unable to crop this image.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getCroppedImg(image: HTMLImageElement, crop: Crop): Promise<string> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return Promise.reject(new Error('Canvas context not available'));
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );
    
    return new Promise((resolve) => {
        resolve(canvas.toDataURL('image/png'));
    });
  }

  async function extractTextFromCrop(
    pdfSourceUrl: string,
    currentPageNumber: number,
    image: HTMLImageElement,
    crop: Crop
  ): Promise<string> {
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    const loadingTask = pdfjs.getDocument(pdfSourceUrl);
    let loadedPdf: Awaited<typeof loadingTask.promise> | null = null;

    try {
      loadedPdf = await loadingTask.promise;
      const page = await loadedPdf.getPage(currentPageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      const pageScaleX = viewport.width > 0 ? viewport.width / image.naturalWidth : 1;
      const pageScaleY = viewport.height > 0 ? viewport.height / image.naturalHeight : 1;

      const left = cropX * pageScaleX;
      const top = cropY * pageScaleY;
      const right = left + (cropWidth * pageScaleX);
      const bottom = top + (cropHeight * pageScaleY);

      const words = (textContent.items as any[])
        .map((item) => {
          const transform = item.transform as number[];
          const tx = (pdfjs as any).Util?.transform
            ? (pdfjs as any).Util.transform(viewport.transform, transform)
            : transform;
          const x = tx[4];
          const y = tx[5];
          const width = Math.abs(item.width ?? 0);
          const height = Math.max(Math.abs(tx[3] ?? 0), Math.abs(item.height ?? 0), 6);
          const itemTop = y - height;
          const itemBottom = y;
          return {
            text: (item.str || '').trim(),
            left: x,
            top: itemTop,
            right: x + width,
            bottom: itemBottom,
          };
        })
        .filter((item) => item.text.length > 0)
        .filter((item) => item.right >= left && item.left <= right && item.bottom >= top && item.top <= bottom)
        .sort((a, b) => {
          if (Math.abs(a.top - b.top) > 6) return a.top - b.top;
          return a.left - b.left;
        });

      const merged = words.map((word) => word.text).join(' ').replace(/\s+/g, ' ').trim();
      return merged;
    } finally {
      if (loadedPdf) {
        await loadedPdf.destroy().catch(() => undefined);
      } else {
        await loadingTask.destroy().catch(() => undefined);
      }
    }
  }

  const goToPrevPage = (event?: React.MouseEvent) => {
    event?.preventDefault();
    onPageNumberChange(Math.max(1, pageNumber - 1));
  };
  const goToNextPage = (event?: React.MouseEvent) => {
    event?.preventDefault();
    onPageNumberChange(Math.min(numPages!, pageNumber + 1));
  };
  const goToTypedPage = (value: string) => {
    setPageInput(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !numPages) return;
    const targetPage = Math.min(Math.max(1, Math.floor(parsed)), numPages);
    if (targetPage !== pageNumber) {
      onPageNumberChange(targetPage);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline text-2xl">
          <FileUp className="w-6 h-6" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          onClick={(event) => {
            // Allow re-selecting the same file (important after Add Question reset).
            (event.currentTarget as HTMLInputElement).value = '';
          }}
          onChange={handleFileChange}
        />
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Upload Source File</p>
              <p className="text-xs text-muted-foreground">Accepted: PDF and image files for cropping.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                {file ? 'Change File' : 'Upload File'}
              </Button>
              {file ? (
                <Button type="button" variant="ghost" onClick={() => onFileChange(null)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {file ? `Selected: ${file.name}` : 'No file selected yet.'}
          </p>
        </div>

        {file && file.type === 'application/pdf' && pdfDocumentUrl && (
          <div ref={pdfContainerRef} className="border-2 border-dashed rounded-lg p-4">
              <Document
                key={pdfDocumentUrl}
                file={pdfDocumentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  setIsRendering(false);
                  toast({ variant: 'destructive', title: 'PDF Load Error', description: error.message });
                }}
                className="flex flex-col items-center"
              >
                <div style={{ display: pageImgSrc ? 'none' : 'block' }}>
                    {isRendering && <div className='flex items-center justify-center p-8'><LoaderCircle className="my-8 h-8 w-8 animate-spin" /></div>}
                     <Page
                       pageNumber={pageNumber}
                       renderTextLayer={false}
                       renderAnnotationLayer={false}
                       onRenderSuccess={onPageRenderSuccess}
                       onRenderError={() => setIsRendering(false)}
                     />
                </div>
              </Document>
              {numPages && (
                <div className="flex items-center justify-center gap-4 mt-4">
                    <Button type="button" variant="outline" size="icon" onClick={goToPrevPage} disabled={pageNumber <= 1}>
                        <ChevronLeft />
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Page</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={pageInput}
                        onChange={(e) => goToTypedPage(e.target.value)}
                        onBlur={() => {
                          if (!numPages) return;
                          if (!pageInput.trim()) {
                            setPageInput(String(pageNumber));
                            return;
                          }
                          const parsed = Number(pageInput);
                          const targetPage = Number.isFinite(parsed)
                            ? Math.min(Math.max(1, Math.floor(parsed)), numPages)
                            : pageNumber;
                          setPageInput(String(targetPage));
                          if (targetPage !== pageNumber) {
                            onPageNumberChange(targetPage);
                          }
                        }}
                        className="h-9 w-20 text-center"
                      />
                      <span>of {numPages}</span>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={goToNextPage} disabled={pageNumber >= numPages}>
                        <ChevronRight />
                    </Button>
                </div>
              )}
          </div>
        )}

        {pageImgSrc && (
          <div className="space-y-4">
            <div className="flex justify-center p-4 border-2 border-dashed rounded-lg">
              <ReactCrop
                crop={crop}
                onChange={(nextCrop) => setCrop(nextCrop)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img ref={imgRef} alt="Crop me" src={pageImgSrc} onLoad={onImageLoad} style={{ maxHeight: '70vh' }} />
              </ReactCrop>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Instructions</AlertTitle>
              <AlertDescription>
                Drag the selection box over the image you want to include. Then click the "Confirm Crop" button.
              </AlertDescription>
            </Alert>

            <Button type="button" onClick={handleConfirmCrop} disabled={isLoading || !completedCrop}>
              {isLoading ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CropIcon className="mr-2 h-4 w-4" />
                  Confirm Crop
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
