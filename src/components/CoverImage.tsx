import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface CoverImageProps {
  src?: string;
  alt: string;
  title: string;
  className?: string;
}

export function CoverImage({ src, alt, title, className = '' }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#EBE6DF] via-[#DFD8CE] to-[#D1C8BA] dark:from-[#262320] dark:via-[#1F1C19] dark:to-[#171513] flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <BookOpen className="w-8 h-8 text-stone-500 dark:text-stone-400 mb-3 opacity-80" strokeWidth={1.5} />
        <span className="font-serif text-base font-medium text-stone-700 dark:text-stone-300 line-clamp-3 leading-snug">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
