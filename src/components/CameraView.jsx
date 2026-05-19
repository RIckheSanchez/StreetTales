import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {StyleSheet} from 'react-native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';

const CameraView = forwardRef(function CameraView(_props, ref) {
  const cameraRef = useRef(null);
  const device = useCameraDevice('back');

  useImperativeHandle(ref, () => ({
    async takeSnapshot() {
      if (!cameraRef.current) return null;
      try {
        const photo = await cameraRef.current.takeSnapshot({
          quality: 85,
          skipMetadata: true,
        });
        return photo;
      } catch (error) {
        console.error('takeSnapshot error:', error);
        return null;
      }
    },
  }));

  if (!device) return null;

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      photo={true}
    />
  );
});

export default CameraView;
