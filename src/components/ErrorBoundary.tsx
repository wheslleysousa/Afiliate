import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0d14] text-stone-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-[#151a26] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-white">Ops! Algo deu errado</h1>
              <p className="text-xs text-stone-400">
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
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar App
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="flex-1 bg-[#0e1119] hover:bg-[#1e2636] border border-[#1e2636] text-stone-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-stone-400" />
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
