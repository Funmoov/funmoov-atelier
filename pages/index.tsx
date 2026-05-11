import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import type { Bike } from '../lib/bike'
import { Api } from '../lib/api'
import type { BikeControlsArgs } from '../components/Controls'
import Login, { BikeAndApiCredentials } from '../components/Login'
import BluetoothConnect from '../components/Connect'
import dynamic from 'next/dynamic'
import { Footer } from '../components/Footer'

const Unsupported = dynamic(() => import('../components/Unsupported'), { ssr: false })
const BikeControls = dynamic<BikeControlsArgs>(() => import('../components/Controls'))

const Home: NextPage = () => {
  const [browserCompatible, setBrowserCompatible] = useState(true)
  const [credentials, setCredentials] = useState<undefined | BikeAndApiCredentials>(undefined)
  const [bikeInstance, setBikeInstance] = useState<undefined | Bike>(undefined)

  const disconnect = () => {
    bikeInstance?.disconnect()
    setBikeInstance(undefined)
  }

  const backToLogin = () => {
    disconnect()
    setCredentials(undefined)
  }

  useEffect(() => {
    setBrowserCompatible(!!navigator.bluetooth)

    const rawBikeCredentials = localStorage.getItem('vm-bike-credentials')
    if (rawBikeCredentials) {
      let api: Api | undefined = undefined
      try {
        const apiCredential = localStorage.getItem('vm-api-credentials')
        api = new Api(JSON.parse(apiCredential ?? ''))
      } catch (e) {
        // Ignore
      }

      try {
        const parsedBikeCredentials = JSON.parse(rawBikeCredentials)

        if (!Array.isArray(parsedBikeCredentials))
          throw 'old bike credentials format'

        setCredentials({
          api,
          bikes: parsedBikeCredentials,
        })
      } catch (e) {
        console.log('unable to parse bike/api credentials from local storage, error:', e)
      }
    }

    import('../lib/bike') // Start importing the bike lib
  }, [])

  useEffect(() => {
    if (bikeInstance) {
      const connectedTimer = setInterval(() => {
        bikeInstance.checkConnection()
          .catch((_) => setBikeInstance(undefined))
      }, 1_000)
      return () => clearTimeout(connectedTimer)
    }
  }, [bikeInstance])

  return (
    <div>
      <main>
        {/* Logo en haut de page */}
        <img src='/funmoov-logo.svg' alt='funmoov atelier' className='logo' />

        <h1 className='title'>funmoov atelier</h1>
        <p className='subtitle'>Outils de diagnostic VanMoof S3 / X3</p>

        {!browserCompatible || (!bikeInstance && !credentials) ?
          <p className='description'>
            Application atelier pour réparation et diagnostic des VanMoof S3 et X3.
            Connexion BLE, lecture des codes erreur, état firmware et batterie.
          </p>
          : undefined}

        {!browserCompatible
          ? <Unsupported />
          : credentials
            ? bikeInstance
              ? <BikeControls
                api={credentials.api}
                bike={bikeInstance}
                disconnect={disconnect}
              />
              : <BluetoothConnect
                bikeCredentials={credentials.bikes}
                updateBikeCredentials={(bikes) => setCredentials(prev => ({ api: prev?.api, bikes }))}
                setBikeInstance={setBikeInstance}
                backToLogin={backToLogin}
              />
            : <Login setCredentials={setCredentials} />
        }
      </main>

      <Footer />

      <style jsx>{`
        main {
          padding: 2.5rem 1.5rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          max-width: 720px;
          margin: 0 auto;
        }
        .logo {
          width: 200px;
          height: 200px;
          margin-bottom: 8px;
          filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.3));
        }
        .title {
          font-size: 2rem;
          text-align: center;
          margin: 0;
          letter-spacing: -1px;
        }
        .subtitle {
          color: var(--text-muted);
          text-align: center;
          margin: 4px 0 24px 0;
          font-size: 1rem;
        }
        .description {
          text-align: center;
          color: var(--text-muted);
          max-width: 480px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}



export default Home
