import {useState, useEffect} from 'react';
import Geolocation from 'react-native-geolocation-service';
import {PermissionsAndroid, Platform} from 'react-native';

const UPDATE_INTERVAL_MS = 10000;

async function requestLocationPermission() {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message: 'StreetTales needs location to find nearby landmarks.',
      buttonPositive: 'OK',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useLocation() {
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let watchId = null;

    requestLocationPermission().then(granted => {
      if (!granted) {
        setError('Location permission denied');
        return;
      }

      watchId = Geolocation.watchPosition(
        position => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setError(null);
        },
        err => setError(err.message),
        {
          accuracy: {android: 'high'},
          interval: UPDATE_INTERVAL_MS,
          fastestInterval: UPDATE_INTERVAL_MS,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    });

    return () => {
      if (watchId != null) Geolocation.clearWatch(watchId);
    };
  }, []);

  return {latitude, longitude, error};
}
