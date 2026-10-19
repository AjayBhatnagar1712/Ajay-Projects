import { Building2 } from "lucide-react";

const PLACEHOLDER_GRADIENTS = [
  "from-blue-200 to-indigo-300",
  "from-gray-200 to-gray-300",
  "from-slate-200 to-blue-200",
  "from-indigo-100 to-blue-200",
  "from-blue-100 to-slate-200",
];

export interface PropertyDetailImageGalleryProps {
  images: string[];
  selectedImage: number;
  onSelect: (index: number) => void;
}

export function PropertyDetailImageGallery({
  images,
  selectedImage,
  onSelect,
}: PropertyDetailImageGalleryProps) {
  const hasImages = images.length > 0;
  const count = hasImages ? images.length : 1;

  return (
    <div>
      <div
        className={`rounded-xl overflow-hidden relative ${hasImages ? "bg-gray-100" : `bg-gradient-to-br ${PLACEHOLDER_GRADIENTS[selectedImage % PLACEHOLDER_GRADIENTS.length]}`}`}
        style={{ height: 340 }}
      >
        {hasImages ? (
          <img
            src={images[selectedImage]}
            alt={`Property image ${selectedImage + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 size={56} className="text-white/40" />
          </div>
        )}
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          {selectedImage + 1} / {count}
        </span>
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-24 h-16 shrink-0 rounded-lg overflow-hidden relative transition-all ${
              selectedImage === index ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"
            } ${hasImages ? "bg-gray-100" : `bg-gradient-to-br ${PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length]}`}`}
          >
            {hasImages ? (
              <img
                src={images[index]}
                alt={`Property thumbnail ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <Building2 size={18} className="text-white/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
