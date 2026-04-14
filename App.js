// frontend/App.js
// Expo React Native 前端应用

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

// ==================== 配置区 ====================
// 请将下面的IP地址替换为您后端服务器的实际IP和端口
// 例如: 'http://192.168.1.100:5000'
const SERVER_URL = 'http://8.134.24.130:5000'; // 修改为您的服务器地址
// ==============================================

export default function App() {
  // 状态管理
  const [originalImage, setOriginalImage] = useState(null);    // 原图URI
  const [grayImage, setGrayImage] = useState(null);            // 灰度图Base64
  const [loading, setLoading] = useState(false);               // 加载状态
  const [hasMediaPermission, setHasMediaPermission] = useState(false); // 媒体库权限

  // 请求媒体库权限（用于保存图片）
  const requestMediaPermissions = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasMediaPermission(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相册权限才能保存图片，请在设置中开启');
    }
    return status === 'granted';
  };

  // 上传图片到服务器并获取灰度图
  const uploadAndProcessImage = async (imageUri) => {
    setLoading(true);
    try {
      // 获取文件名和扩展名
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // 创建FormData
      const formData = new FormData();
      // @ts-ignore - React Native的FormData支持blob/file对象
      formData.append('image', {
        uri: imageUri,
        name: filename,
        type: type,
      });

      // 发送请求
      const response = await fetch(`${SERVER_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      // 获取二进制图片数据并转为Base64
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
      const base64 = reader.result;
      console.log('Base64 长度:', base64 ? base64.length : 'null');
      if (!base64 || typeof base64 !== 'string') {
        Alert.alert('错误', '从服务器获取的图片数据无效');
        setLoading(false);
        return;
       }
          setGrayImage(base64);
         setLoading(false);
      };
      reader.onerror = () => {
        throw new Error('读取图片数据失败');
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('上传处理失败:', error);
      Alert.alert('错误', error.message || '图片处理失败，请检查网络或服务器');
      setLoading(false);
    }
  };

  // 从相册选择图片
  const pickFromGallery = async () => {
    try {
      // 请求相册权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要相册权限才能选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8, // 压缩质量
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setOriginalImage(uri);
        setGrayImage(null); // 清空之前的灰度图
        await uploadAndProcessImage(uri);
      }
    } catch (error) {
      console.error('相册选择失败:', error);
      Alert.alert('错误', '打开相册失败');
    }
  };

  // 拍照上传
  const takePhoto = async () => {
    try {
      // 请求相机权限
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要相机权限才能拍照');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setOriginalImage(uri);
        setGrayImage(null);
        await uploadAndProcessImage(uri);
      }
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('错误', '打开相机失败');
    }
  };

  // 保存灰度图片到相册
  const saveGrayImage = async () => {
  // 1. 严格检查 grayImage 是否存在且为字符串
  if (!grayImage || typeof grayImage !== 'string') {
    Alert.alert('提示', '没有可保存的灰度图片，请先转换图片');
    return;
  }

  // 2. 提取 Base64 数据部分
  const base64Match = grayImage.match(/^data:image\/\w+;base64,(.*)$/);
  let base64Data = base64Match ? base64Match[1] : null;

  // 兼容没有前缀的情况（直接传纯 base64）
  if (!base64Data && grayImage.includes(',')) {
    base64Data = grayImage.split(',')[1];
  } else if (!base64Data) {
    base64Data = grayImage;
  }

  if (!base64Data) {
    Alert.alert('错误', '图片数据格式无效');
    return;
  }

  // 3. 请求权限（原有逻辑）
  setLoading(true);
  try {
    const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('权限不足', '需要相册写入权限才能保存图片');
      setLoading(false);
      return;
    }

    // 4. 保存图片
    const tempFileName = `grayscale_${Date.now()}.jpg`;
    const tempFileUri = FileSystem.documentDirectory + tempFileName;
    await FileSystem.writeAsStringAsync(tempFileUri, base64Data, {
      encoding: 'base64',
    });
    await MediaLibrary.saveToLibraryAsync(tempFileUri);
    await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
    Alert.alert('成功', '灰度图片已保存到相册');
  } catch (error) {
    console.error('保存失败:', error);
    Alert.alert('错误', `保存失败：${error.message}`);
  } finally {
    setLoading(false);
  }
};

  // 重置所有图片
  const resetImages = () => {
    setOriginalImage(null);
    setGrayImage(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>图片灰度转换器</Text>
      <Text style={styles.subtitle}>将彩色图片转为优雅的黑白灰效果</Text>

      {/* 操作按钮组 */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickFromGallery}>
          <Text style={styles.buttonText}>📁 从相册选择</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 拍照上传</Text>
        </TouchableOpacity>
      </View>

      {/* 加载指示器 */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>处理图片中，请稍候...</Text>
        </View>
      )}

      {/* 图片展示区域 */}
      {(originalImage || grayImage) && !loading && (
        <View style={styles.imagesContainer}>
          {originalImage && (
            <View style={styles.imageCard}>
              <Text style={styles.imageLabel}>原图</Text>
              <Image source={{ uri: originalImage }} style={styles.image} resizeMode="contain" />
            </View>
          )}
          {grayImage && (
            <View style={styles.imageCard}>
              <Text style={styles.imageLabel}>灰度效果</Text>
              <Image source={{ uri: grayImage }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        </View>
      )}

      {/* 保存和重置按钮 */}
      {grayImage && !loading && (
        <View style={styles.actionGroup}>
          <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveGrayImage} disabled={!grayImage || loading}>
            <Text style={styles.buttonText}>💾 保存灰度图片</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetImages}>
            <Text style={styles.buttonText}>🔄 重新开始</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 底部提示 */}
      <Text style={styles.footer}>✨ 支持JPG、PNG、BMP等格式</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  galleryButton: {
    backgroundColor: '#3498DB',
  },
  cameraButton: {
    backgroundColor: '#2ECC71',
  },
  saveButton: {
    backgroundColor: '#9B59B6',
    flex: 1,
    marginRight: 8,
  },
  resetButton: {
    backgroundColor: '#E67E22',
    flex: 1,
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    marginVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7F8C8D',
  },
  imagesContainer: {
    width: '100%',
    marginVertical: 20,
  },
  imageCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#ECF0F1',
  },
  actionGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: '#95A5A6',
    textAlign: 'center',
  },
});