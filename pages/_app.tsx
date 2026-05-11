import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

function MyApp({ Component, pageProps }: AppProps) {
  return <div>
    <Head>
      <title>funmoov atelier — Diagnostic VanMoof S3 / X3</title>
      <link rel="icon" type="image/svg+xml" href="/funmoov-logo.svg" />
      <link rel="manifest" href="/app.webmanifest"></link>
      <meta name="description" content="Outils de diagnostic atelier pour les vélos VanMoof S3 et X3" />
      <meta property="og:title" content="funmoov atelier — Diagnostic VanMoof S3 / X3" />
      <meta name="theme-color" content="#1d3a4a" />
    </Head>
    <Component {...pageProps} />
    <div id="modals" />
  </div>
}

export default MyApp
