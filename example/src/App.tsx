import VonageVoice from '@technotoil/vonage-voice';
import axios from 'axios';

import {
  JSXElementConstructor,
  ReactElement,
  ReactNode,
  ReactPortal,
  useEffect,
  useState,
} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  // phone number being typed
  const [number, setNumber] = useState<string>('');
  // whether UI is in calling state
  const [isCalling, setIsCalling] = useState<boolean>(false);
  // call duration timer
  const [seconds, setSeconds] = useState<number>(0);
  const [mute, setMute] = useState<boolean>(false);
  const [speakerOn, setSpeakerOn] = useState<boolean>(false);
  // store the active call id (string) when a call starts
  const [sessionId, setSessionId] = useState<string | null>(null);
  // call status (number codes used by SDK), null when unknown
  const [callStatus, setCallStatus] = useState<number | null>(null);

  useEffect(() => {
    // Register for events
    const subs = [
      VonageVoice.addListener('onIncomingCall', (data) => {
        console.log('Incoming call:', data);
        Alert.alert('Incoming Call', `From: ${data.from}`);
      }),
      VonageVoice.addListener('onCallAnswered', (data) => {
        console.log('Call answered:', data);
      }),
      VonageVoice.addListener('onCallEnded', (data) => {
        setIsCalling(false);
        console.log('Call ended:', data);
      }),
      VonageVoice.addListener('onSessionError', (data) => {
        console.log('Session error:', data);
      }),
      VonageVoice.addListener('onCallMuted', (data) => {
        console.log('Call muted', data);
      }),
      VonageVoice.addListener('onCallUnmuted', (data) => {
        console.log('Call unmuted', data);
      }),
    ];

    // Cleanup
    return () => subs.forEach((s) => s.remove());
  }, []);

  useEffect(() => {
    requestMicPermission();
  }, []);

  useEffect(() => {
    handleLogin();
  }, []);

  useEffect(() => {
    // If we have an active call id, fetch the last known status and subscribe
    // to live updates for that call.
    if (!sessionId) return;

    // 1) Get last known status when component mounts for this session
    VonageVoice.getCallStatus(sessionId)
      .then((status: number) => {
        console.log('Last known status for call:', status);
        setCallStatus(status ?? null);
      })
      .catch((err: any) => {
        console.warn('No status available:', err, sessionId);
        setCallStatus(null);
      });

    // 2) Listen to live status updates
    const subscription = VonageVoice.addListener(
      'onCallStatus',
      (event: any) => {
        // event is expected to contain { callId, status }
        if (!event || !event.callId) return;
        if (event.callId === sessionId) {
          console.log('Live call status update:', event.status);
          setCallStatus(event.status ?? null);
        }
      }
    );

    // Cleanup subscription on unmount or when sessionId changes
    return () => subscription.remove();
  }, [sessionId]);

  const requestMicPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        return granted === RESULTS.GRANTED;
      } else {
        const granted = await request(PERMISSIONS.IOS.MICROPHONE);
        return granted === RESULTS.GRANTED;
      }
    } catch (e) {
      console.log('Mic permission error:', e);
      return false;
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.get('https://api.dev.linkrwave.io/user/vonage/callToken/6912cd96ce02275a5135f412');
      // Expect the API to return { token: string }
      await VonageVoice.login(response.data.token);
    } catch (error) {
      console.log('API Error:', error);
    }
  };

  const formatNumberUniversal = (input: string, countryCode = ''): string => {
    // Remove all non-digit characters
    let number = input.replace(/\D/g, '');

    // Remove leading zeros from the number
    if (number.startsWith('0')) {
      number = number.slice(1);
    }

    // Prepend country code if provided
    if (countryCode) {
      // Remove any non-digit characters from country code
      countryCode = countryCode.replace(/\D/g, '');
      return countryCode + number;
    }

    return number;
  };

  const handleCall = async () => {
    const finalNumber = formatNumberUniversal(number);
    try {
      const userNumber = '12134098481'; //your number
      const res = await VonageVoice.call(finalNumber, userNumber);
      // Expect `res` to be a callId string
      setSessionId(String(res));
    } catch (e) {
      console.error('Call failed:', e);
      setIsCalling(false);
    }
  };

  const handlePress = (digit: string) => {
    setNumber((prev) => prev + digit);
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleMuteUnmute = () => {
    if (!sessionId) {
      console.warn('No active call');
      return;
    }

    if (!mute) {
      if (Platform.OS === 'android') {
        // Android expects a callId string
        VonageVoice.mute(sessionId)
          .then(() => {
            console.log('Call muted');
            setMute(true);
          })
          .catch((err: any) => console.log('Mute error', err));
      } else {
        // iOS API in our wrapper also expects callId string — use the same value
        VonageVoice.mute(sessionId)
          .then(() => {
            console.log('Call muted');
            setMute(true);
          })
          .catch((err: any) => console.log('Mute error', err));
      }
    } else {
      if (Platform.OS === 'android') {
        VonageVoice.unmute(sessionId)
          .then(() => {
            console.log('Call unmuted');
            setMute(false);
          })
          .catch((err: any) => console.log('Unmute error', err));
      } else {
        VonageVoice.unmute(sessionId)
          .then(() => {
            console.log('Call unmuted');
            setMute(false);
          })
          .catch((err: any) => console.log('Unmute error', err));
      }
    }
  };

  const handleEndCall = async () => {
    setIsCalling(false);
    setNumber('');
    setSeconds(0);
    setMute(false);
    setSpeakerOn(false);

    if (Platform.OS === 'android') {
      VonageVoice.hangup(sessionId as string)
        .then(() => {
          console.log('Hangup success');
          setSessionId('');
        })
        .catch((err: any) => console.log('Hangup error', err));
    } else {
      VonageVoice.hangup(sessionId as string)
        .then(() => {
          console.log('Hangup success');
          setSessionId('');
        })
        .catch((err: any) => console.log('Hangup error', err));
    }
  };

  useEffect(() => {
    let timer: string | number | NodeJS.Timeout | undefined;

    // Only start timer if callStatus === 2 (active)
    if (callStatus === 2) {
      timer = setInterval(() => {
        setSeconds((sec) => sec + 1);
      }, 1000);
    }

    // Stop timer when callStatus is not 2 (ended, failed, etc.)
    if (callStatus !== 2) {
      setSeconds(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  const formatTime = () => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  const toggleSpeaker = () => {
    const newState = !speakerOn;
    VonageVoice.setSpeaker(newState)
      .then(() => setSpeakerOn(newState))
      .catch((err: any) => console.log('Speaker toggle error', err));
  };

  const renderButton = (
    digit:
      | string
      | number
      | bigint
      | boolean
      | ReactElement<unknown, string | JSXElementConstructor<any>>
      | Iterable<ReactNode>
      | Promise<
        | string
        | number
        | bigint
        | boolean
        | ReactPortal
        | ReactElement<unknown, string | JSXElementConstructor<any>>
        | Iterable<ReactNode>
        | null
        | undefined
      >
      | null
      | undefined,
    subText = ''
  ) => (
    <TouchableOpacity style={styles.button} onPress={() => handlePress(digit)}>
      <Text style={styles.buttonText}>{digit}</Text>
      {subText ? <Text style={styles.subText}>{subText}</Text> : null}
    </TouchableOpacity>
  );

  if (isCalling) {
    return (
      <SafeAreaView style={styles.callContainer}>
        {/* Top: Caller Number + Timer */}
        {/* <Text style={styles.callingText}>Calling…</Text> */}
        <Text style={styles.callNumber}>{number}</Text>

        <Text style={styles.callTimer}>
          {callStatus === 2 ? formatTime() : 'Calling…'}
        </Text>

        {/* Middle Buttons */}
        <View style={styles.inCallButtons}>
          {/* Mute */}
          <TouchableOpacity
            style={[styles.circleButton, mute && styles.activeButton]}
            onPress={handleMuteUnmute}
          >
            <Text style={styles.buttonIcon}>🔇</Text>
            <Text style={styles.buttonLabel}>{mute ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Speaker */}
          <TouchableOpacity
            style={[styles.circleButton, speakerOn && styles.activeButton]}
            onPress={toggleSpeaker}
          >
            <Text style={styles.buttonIcon}>🔊</Text>
            <Text style={styles.buttonLabel}>Speaker</Text>
          </TouchableOpacity>
          {/* End Call */}
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Text style={styles.endCallText}>❌</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.display}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <View style={styles.dialpad}>
        <View style={styles.row}>
          {renderButton('1')} {renderButton('2', 'ABC')}{' '}
          {renderButton('3', 'DEF')}
        </View>
        <View style={styles.row}>
          {renderButton('4', 'GHI')} {renderButton('5', 'JKL')}{' '}
          {renderButton('6', 'MNO')}
        </View>
        <View style={styles.row}>
          {renderButton('7', 'PQRS')} {renderButton('8', 'TUV')}{' '}
          {renderButton('9', 'WXYZ')}
        </View>
        <View style={styles.row}>
          {renderButton('*')} {renderButton('0', '+')} {renderButton('#')}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setIsCalling(true);
              handleCall();
            }}
          >
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
  },
  display: {
    alignItems: 'center',
    marginBottom: 30,
  },
  numberText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  dialpad: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#fff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 2,
  },
  buttonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 12,
    color: '#888',
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 40,
    marginHorizontal: 20,
  },
  actionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 50,
  },
  callingText: { fontSize: 20, color: '#aaa', marginBottom: 5 },
  callNumber: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  callTimer: { fontSize: 18, color: '#ccc', marginBottom: 40 },

  inCallButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 50,
  },

  circleButton: {
    backgroundColor: '#2c2c2c',
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  activeButton: {
    backgroundColor: '#4caf50', // green for active
  },
  buttonIcon: { fontSize: 32, color: '#fff', marginBottom: 5 },
  buttonLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },

  endCallButton: {
    backgroundColor: 'red',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  endCallText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
});
