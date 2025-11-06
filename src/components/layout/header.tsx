
import { Rocket } from 'lucide-react';
import type { FC } from 'react';

export const Header: FC = () => {
  return (
    <header className="bg-card border-b shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <Rocket className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold font-headline text-foreground">
                Dyn Banner RenderGrid
              </h1>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
