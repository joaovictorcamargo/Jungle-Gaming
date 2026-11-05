import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { markBackendReady } from './lib/backend-ready'
import { App } from './app'
// A página inicial entra no chunk de entrada (o Vite a pré-carrega com <link rel="modulepreload">),
// evitando uma etapa serial de rede antes da primeira pintura; as demais rotas continuam sob demanda.
import './pages/home'

// A interface é renderizada sem esperar o MSW: as requisições (Axios e Socket.IO) aguardam `backendReady`.
// O `socket.io-client` é importado dinamicamente só ao conectar, depois de `backendReady`,
// portanto sempre depois do interceptor de WebSocket do MSW.
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  // Mocks ativados por configuração (VITE_ENABLE_MOCKS), inclusive no build de demonstração.
  // Inicia o MSW depois do primeiro frame, para a avaliação do worker não atrasar a primeira pintura.
  requestAnimationFrame(() => setTimeout(() => {
    import('./mocks/browser')
      .then((m) => m.startMocks())
      .then(markBackendReady, (e: unknown) => { console.error('Falha ao iniciar os mocks', e); markBackendReady() })
  }, 0))
} else markBackendReady()
