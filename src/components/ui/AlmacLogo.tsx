import carbonmashLogo from '@/assets/carbonmash-logo.webp';

interface AlmacLogoProps {
  className?: string;
}

export const AlmacLogo = ({ className = "h-10" }: AlmacLogoProps) => {
  return (
    <img 
      src={carbonmashLogo} 
      alt="CarbonMash" 
      className={className}
    />
  );
};
