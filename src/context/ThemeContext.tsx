import React, { createContext, useContext, useState } from 'react';

interface ThemeContextType {
  theme: 'black-blue-white';
  primaryColor: string;
  bgClass: string;
  accentClass: string;
  textClass: string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'black-blue-white',
  primaryColor: '#3b82f6',
  bgClass: 'bg-black',
  accentClass: 'bg-blue-600 text-white hover:bg-blue-500 border-blue-500',
  textClass: 'text-white',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useState<'black-blue-white'>('black-blue-white');

  return (
    <ThemeContext.Provider
      value={{
        theme,
        primaryColor: '#3b82f6',
        bgClass: 'bg-black',
        accentClass: 'bg-blue-600 text-white hover:bg-blue-500 border-blue-500',
        textClass: 'text-white',
      }}
    >
      <div className="bg-black text-white min-h-screen font-sans selection:bg-blue-600 selection:text-white dark">
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
