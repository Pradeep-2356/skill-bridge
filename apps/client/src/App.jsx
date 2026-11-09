import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from './context/ToastContext.jsx';
import { routes } from './routes/routes.jsx';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
