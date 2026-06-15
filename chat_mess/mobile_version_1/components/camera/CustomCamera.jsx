import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Camera, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import Slider from '@react-native-community/slider';
import Button from '../Button';

export default function CustomCamera() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermissionResponse, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraProps, setCameraProps] = useState({
    zoom: 0,
    facing: 'front',
    flash: 'on',
    animateShutter: false,
    enableTorch: false,
  });

  const [image, setImage] = useState(null);

  const cameraRef = useRef(null);


  useEffect(() => {
    const getPermissions = async () => {
      const cameraStatus = await requestCameraPermission();
      const mediaLibraryStatus = await requestMediaLibraryPermission();
      setHasPermission(cameraStatus.granted && mediaLibraryStatus.granted);
    };
    
    getPermissions();
  }, []);


  if(!cameraPermission || !mediaLibraryPermissionResponse){
    return <View/>
  }

  if (!cameraPermission.granted || mediaLibraryPermissionResponse.status !== 'granted') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permissions to continue</Text>
        <TouchableOpacity style={styles.button} onPress={() => {
            requestCameraPermission();
            requestMediaLibraryPermission();
        }}>
          <Text style={styles.buttonText}>Grant permissions</Text>
        
        </TouchableOpacity>
      </View>
    );
  }


  const toggleProperty = (prop, option1, option2) => {
    setCameraProps((current) => ({
        ...current,
        [prop]:current[prop] === option1 ? option2 : option1
    }));
  };

  const zoomIn = () => {
    setCameraProps((current) => ({
        ...current,
        zoom: Math.min(current.zoom + 0.1, 1)
    }))
  }

  const zoomOut = () => {
    setCameraProps((current) => ({
        ...current,
        zoom: Math.max(current.zoom - 0.1, 0)
    }))
  }

  // function to take a picture and show it without saving it
  const takePicture = async() => {
    if(cameraRef.current){
        try{
            const picture = await cameraRef.current.takePictureAsync();
            setImage(picture.uri);
        }catch(err){
            console.log('Error while taking the picture : ', err);

        }
    }
  }

  //function to save the picture using MediaLiblary

  const savePicture = async() => {
    if(image) {
        try{
            const asset = await MediaLibrary.createAssetAsync(image);
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
            Alert.alert('Photo saved!', image);
            setImage(null);
        }catch(err){
            console.log('Error with saving the picture : ', err)
        }
    }
  }




  return (
    <View style={styles.container}>
      
      {!image ? (
        <>
            <View style={styles.topControlsContainer}>
                <Button 
                    icon='flip-camera-ios'
                    onPress={() => toggleProperty('facing', 'front', 'back')}
                />
                <Button 
                    icon={cameraProps.flash === 'on' ? 'flash-on' : 'flash-off'}
                    onPress={() => toggleProperty('flash', 'on', 'off')}
                />
                <Button 
                    icon='animation'
                    color={cameraProps.animateShutter ? 'white' : '#404040'}
                    onPress={() => toggleProperty('animateShutter', true, false)}
                />
                <Button 
                    icon={cameraProps.enableTorch ? 'flashlight-on' : 'flashlight-off'}
                    onPress={() => toggleProperty('enableTorch', true, false)}
                />
            </View>
            <Camera  
                style={styles.camera} 
                zoom={cameraProps.zoom}
                // facing={cameraProps.facing}
                type={CameraType.back}
                flash={cameraProps.flash}
                animateShutter={cameraProps.animateShutter}
                enableTorch={cameraProps.enableTorch}
                ref={cameraRef}
                // type={CameraType.back} 
            />
            <View style={styles.sliderContainer}>
                <Button 
                    icon='zoom-out' 
                    onPress={zoomOut} 
                />
                <Slider 
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    value={cameraProps.zoom}
                    onValueChange={(value) => setCameraProps((current) => ({...current, zoom:value}))}
                    step={0.1}
                />
        
                <Button 
                    icon='zoom-in' 
                    onPress={zoomOut} 
                />
            </View>
            <View style={styles.bottomControlsContainer}>
                <Button 
                    icon='camera'
                    size={60}
                    style={{height:60}}
                    onPress={takePicture}
                />
            </View>
       </>

      ) : (
        <>

            <Image source={{uri: image}} style={styles.camera} />
            <View style={styles.bottomControlsContainer}>
                <Button 
                    icon='flip-camera-android'
                    onPress={() => setImage(null)}
                />

                <Button 
                    icon='check'
                    onPress={savePicture}
                />

            </View>
        
        </>
      )}

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    marginTop: 30
  },
  topControlsContainer:{
    height: 100,
    backgroundColor: 'black',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  text:{
    color: 'white'
  },
  button: {
    backgroundColor: '#7C5CFF',
    padding: 20,
    margin: 10,
    borderRadius: 5,
  },
  buttonText:{
    color: 'white',
    fontSize: 16,
  },
  camera:{
    flex: 1,
    width: '100%'
  },
  slider:{
    flex: 1,
    marginHorizontal: 10,
  },
  sliderContainer:{
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
  },
  bottomControlsContainer:{
    height: 100,
    backgroundColor: 'black',
    flexDirection: 'row',
    justifyContent: 'space-around',

  }
});


///////////////////////////////////////////////////////n///////////////////////////////////////////////////////////////

// import React, { useEffect, useRef, useState } from 'react';
// import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
// import Icon from '@expo/vector-icons/MaterialCommunityIcons';
// import * as MediaLibrary from 'expo-media-library';
// import { Camera } from 'expo-camera';

// export default function CustomCamera() {
//     const [medias, setMedias] = useState([]); // Состояние для медиафайлов
//     const [hasPermissions, setHasPermissions] = useState(false); // Состояние разрешений
//     const cameraRef = useRef(null); // Ссылка на камеру

//     useEffect(() => {
//         (async () => {
//             try {
//                 // Запрос разрешений
//                 const cameraPermission = await Camera.requestCameraPermissionsAsync();
//                 const mediaPermission = await MediaLibrary.requestPermissionsAsync();

//                 if (cameraPermission.status === 'granted' && mediaPermission.status === 'granted') {
//                     setHasPermissions(true);

//                     // Загрузка медиафайлов
//                     const files = await MediaLibrary.getAssetsAsync({
//                         first: 25,
//                         mediaType: ['photo', 'video'],
//                         sortBy: 'creationTime',
//                     });
//                     setMedias(files.assets);
//                 } else {
//                     setHasPermissions(false);
//                 }
//             } catch (error) {
//                 console.error('Ошибка при запросе разрешений:', error);
//             }
//         })();
//     }, []);

//     if (!hasPermissions) {
//         return (
//             <View style={styles.center}>
//                 <Text style={{ color: '#fff' }}>
//                     Camera access is denied. Please enable it in your device settings.
//                 </Text>
//             </View>
//         );
//     }

//     const takePhoto = async () => {
//         if (cameraRef.current) {
//             const photo = await cameraRef.current.takePictureAsync();
//             const asset = await MediaLibrary.createAssetAsync(photo.uri);
//             setMedias((prevMedias) => [asset, ...prevMedias]);
//         }
//     };

//     return (
//         <View style={styles.container}>
//             <Camera style={styles.camera} ref={cameraRef} />
//             <View style={styles.footer}>
//                 {/* Галерея медиа */}
//                 <View style={styles.medias}>
//                     <FlatList
//                         data={medias}
//                         renderItem={({ item }) => (
//                             <Image
//                                 style={styles.media}
//                                 source={{ uri: item.uri }}
//                                 resizeMode="cover"
//                             />
//                         )}
//                         keyExtractor={(item) => item.id}
//                         horizontal
//                     />
//                 </View>

//                 {/* Кнопки управления */}
//                 <View style={styles.buttons}>
//                     <TouchableOpacity>
//                         <Icon name="flash" color="#fff" size={30} />
//                     </TouchableOpacity>
//                     <TouchableOpacity onPress={takePhoto}>
//                         <Icon name="camera-iris" color="#fff" size={100} />
//                     </TouchableOpacity>
//                     <TouchableOpacity>
//                         <Icon name="camera-party-mode" color="#fff" size={30} />
//                     </TouchableOpacity>
//                 </View>
//             </View>
//         </View>
//     );
// }

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//     },
//     camera: {
//         flex: 1,
//     },
//     footer: {
//         position: 'absolute',
//         bottom: 0,
//         width: '100%',
//         backgroundColor: 'rgba(0, 0, 0, 0.5)', // Затемнённый фон
//     },
//     medias: {
//         flex: 1,
//         alignItems: 'center',
//         marginBottom: 10,
//     },
//     media: {
//         width: 80,
//         height: 80,
//         marginHorizontal: 2,
//         borderRadius: 5,
//     },
//     buttons: {
//         flexDirection: 'row',
//         justifyContent: 'space-around',
//         alignItems: 'center',
//         marginVertical: 10,
//     },
//     center: {
//         flex: 1,
//         alignItems: 'center',
//         justifyContent: 'center',
//         backgroundColor: '#000',
//     },
// });







////////////////////////////////////////////// 1 - variant ////////////////////////////////////////////////////////////////////////////

// import React, {useEffect, useState} from 'react'
// import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native'
// import Icon from '@expo/vector-icons/MaterialCommunityIcons';
// import { theme } from '../../theme';

// import * as MediaLibrary from 'expo-media-library';
// import { Camera } from 'expo-camera';

// export default function CustomCamera() {

//     const [medias, setMedias] = useState([]);
//     const [hasPermissions, setHasPermission] = useState(false);

//     useEffect(() => {
//         (async () => {
//             if(await requireCameraPermissions()){
//                 setHasPermission(true);
//             }
//             if(await requireCameraRollPermissions()){
//                 const files = await MediaLibrary.getAssetsAsync({
//                     first: 25,
//                     mediaType: ["photo", "video"],
//                     sortBy: "creationTime"
//                 })
//                 setMedias(files.assets);
//             }
//         })();
//     }, []);
    
//     const requireCameraRollPermissions = async () => {
//         const {status} = await MediaLibrary.requestPermissionsAsync(false);
//         return status === "granted";
//     };

//     const requireCameraPermissions = async () => {
//         const {status} = await Camera.requestPermissionsAsync(false);
//         return status === "granted";
//     }
//     if (!hasPermissions){
//         return  <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
//                     <Text style={{color: '#fff'}}>No access to Camera</Text>
//                 </View>
//     }

//   return (
//     <View style={styles.container}>
//         <Camera style={styles.camera} />
//       <View style={styles.footer}>
//         <View style={styles.medias}>
//             <FlatList data={medias} renderItem={({item}) => <Image style={styles.media} source={{uri: item.uri}} resizeMode='cover' />}
//                 keyExtractor={item => item.id}
//                 horizontal
//             />
//             <View style={styles.buttons}>
//                 <TouchableOpacity>
//                     <Icon name="flash" color={theme.colors.white} size={30}/>
//                 </TouchableOpacity>
//                 <TouchableOpacity>
//                     <Icon name="camera-iris" color={theme.colors.white} size={100}/>
//                 </TouchableOpacity>
//                 <TouchableOpacity>
//                     <Icon name="camera-party-mode" color={theme.colors.white} size={30}/>
//                 </TouchableOpacity>
//             </View>
//         </View>
//       </View>
//     </View>
//   )
// }

// const styles = StyleSheet.create({
//     container:{
//         flex: 1
//     },
//     camera:{
//         flex: 1
//     },
//     footer:{
//         position: 'absolute',
//         bottom: 0,
//         width: '100%'
//     },
//     medias:{
//         flex: 1,
//         alignItems: 'center',
//         marginBottom: 10
//     },
//     media:{
//         width: 80,
//         height: 80,
//         marginHorizontal: 2
//     },
//     buttons:{
//         flex: 1,
//         width: '100%',
//         flexDirection: "row",
//         alignItems: 'center',
//         justifyContent: 'space-around',
//         marginBottom: 20
//     }
// })