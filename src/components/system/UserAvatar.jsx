import { useEffect, useMemo, useState } from 'react';
import { avatarCandidates, avatarLabel } from './avatarUtils';

export default function UserAvatar({
  memberInfo = {},
  name = '',
  sizeClass = 'h-8 w-8',
  textClass = 'text-[12px]',
  className = '',
  imgClassName = 'h-full w-full object-cover',
}) {
  const label = avatarLabel(memberInfo, name);
  const candidates = useMemo(() => avatarCandidates(memberInfo, label), [memberInfo, label]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates.join('|')]);

  const src = candidates[candidateIndex] || candidates[candidates.length - 1];
  return (
    <div className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F2FF] ${textClass} font-bold text-[#1F1F1E] ${className}`}>
      {src ? (
        <img
          src={src}
          alt={label}
          className={imgClassName}
          onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length - 1))}
        />
      ) : (
        <span>{label.slice(0, 1) || '?'}</span>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
    </div>
  );
}
