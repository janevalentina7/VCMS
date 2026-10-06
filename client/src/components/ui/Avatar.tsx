import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export const Avatar = ({ name, src, size = 'md', className }: AvatarProps) => (
  <span
    className={cn(
      'grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary ring-1 ring-line',
      SIZES[size],
      className,
    )}
    aria-hidden={!name}
  >
    {src ? <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" /> : initials(name || '?')}
  </span>
);

export default Avatar;
