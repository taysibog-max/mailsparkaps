import '../styles/globals.css';
import { StoreProvider } from '../context/StoreContext';
import ProgressBar from '../components/ProgressBar';

export default function App({ Component, pageProps }) {
  return (
    <StoreProvider>
      <ProgressBar />
      <Component {...pageProps} />
    </StoreProvider>
  );
}


