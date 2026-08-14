import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export interface ErrorBoundaryProps {
  children?: ReactNode;
  title?: string;
  fallbackMessage?: string;
  isTabLevel?: boolean;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearCacheAndReload = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.isTabLevel) {
        return (
          <div className="bg-[#151a26] border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl my-4 animate-fadeIn">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {this.props.title || 'Algo deu errado nesta seção'}
              </h3>
              <p className="text-xs text-[#93a0b5] max-w-md mx-auto">
                {this.props.fallbackMessage ||
                  'Ocorreu uma falha temporária ao carregar este módulo. As outras abas e a navegação continuam funcionando normalmente.'}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#0e1119] rounded-xl border border-[#1e2636] text-left text-[11px] text-red-300 font-mono overflow-x-auto max-h-28 max-w-lg mx-auto">
                <strong>{this.state.error.name}:</strong> {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar Novamente
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#07090f] text-[#eef2f9] flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-[#151a26] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-extrabold text-white">Ops! Algo deu errado</h1>
              <p className="text-xs text-[#93a0b5]">
                Ocorreu uma falha inesperada na renderização da interface.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#0e1119] rounded-xl border border-[#1e2636] text-left text-[11px] text-red-300 font-mono overflow-x-auto max-h-36">
                <strong>{this.state.error.name}:</strong> {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar App
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="flex-1 bg-[#0e1119] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-[#93a0b5]" />
                Limpar Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
