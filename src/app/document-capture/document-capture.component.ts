import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import axios from 'axios';
import * as Tesseract from 'tesseract.js';

@Component({
  selector: 'app-document-capture',
  templateUrl: './document-capture.component.html',
  styleUrls: ['./document-capture.component.scss']
})
export class DocumentCaptureComponent implements AfterViewInit {
  @ViewChild('video', { static: true }) videoElement!: ElementRef;
  @ViewChild('canvas', { static: true }) canvasElement!: ElementRef;
  video!: any;
  canvas!: any;
  capturedImage!: Tesseract.ImageLike | undefined;
  category!: string;
  tags: string[] = [];
  sourceText!: string;
  videoDevices!: MediaDeviceInfo[];
  isReadyToCapture: boolean = false;

  constructor() {
    this.capturedImage = undefined;
  }

  ngAfterViewInit() {
    this.video = this.videoElement.nativeElement;
    this.canvas = this.canvasElement.nativeElement;
    this.getCameraList();
  }

  getCameraList() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      console.log(devices)
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (this.videoDevices?.length == 0) {
        console.error('No video devices found.');
      }
    });
  }

  startMediaStream(device: MediaDeviceInfo) {
    this.capturedImage = undefined;
    navigator.mediaDevices.getUserMedia({ video: { deviceId: device.deviceId } })
      .then(stream => {
        this.video.srcObject = stream;
        this.video.play();
      })
      .catch(err => {
        console.error('Error accessing video stream:', err);
      });
  }  

  onVideoEvent(event: any) {
    this.isReadyToCapture = (event?.type === 'loadeddata' || event?.type === 'progress');
  }

  captureImage() {
    setTimeout(async () => {
      const context = this.canvas.getContext('2d');
      context.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);

      let imageData = context.getImageData(0, 0, this.video.videoWidth, this.video.videoHeight);

      this.thresholdImage(imageData, 128);
      
      imageData = context.getImageData(0, 0, this.video.videoWidth, this.video.videoHeight);

      const textRegions = this.findTextRegions(imageData);
      this.recognizeTextRegions(imageData, textRegions);


      this.capturedImage = this.canvas.toDataURL();


      this.video.srcObject = null;
      this.video.load();
      // OCR text extraction
      this.sourceText = '(Extraction pending...)';
      try {
        this.sourceText = await this.extractTextFromImage(this.capturedImage as Tesseract.ImageLike);
      } catch(err) {
        this.sourceText = 'Extraction failed';
        console.error('OCR Error:', err);
      }
    }, 1);
  }

  findTextRegions(imageData: any): { x: number, y: number, width: number, height: number }[] {
    const textRegions: { x: number, y: number, width: number, height: number }[] = [];
    if (imageData) {
      // Perform OTSU thresholding
      const threshold = this.otsuThreshold(imageData);
      const data: Uint8ClampedArray = imageData.data;

      // Find text regions based on the thresholded image
      let currentRegion: { x: number, y: number, width: number, height: number } | null = null;
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const index = (y * imageData.width + x) * 4;
          const averageValue = (data[index] + data[index + 1] + data[index + 2]) / 3;
          const newValue = averageValue < threshold ? 0 : 255;
          data[index] = data[index + 1] = data[index + 2] = newValue;

          if (newValue === 0) {
            if (!currentRegion) {
              currentRegion = { x, y, width: 1, height: 1 };
            } else {
              currentRegion.width++;
            }
          } else if (currentRegion) {
            textRegions.push(currentRegion);
            currentRegion = null;
          }
        }

        if (currentRegion) {
          textRegions.push(currentRegion);
          currentRegion = null;
        }
      }
    }

    return textRegions;
  }

  otsuThreshold(imageData: any): number {
    const data: Uint8ClampedArray = imageData.data;
    // Calculate the histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const averageValue = (data[i] + data[i + 1] + data[i + 2]) / 3;
      histogram[Math.floor(averageValue)]++;
    }

    // Calculate the total number of pixels
    const totalPixels = imageData.width * imageData.height;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let mB;
    let mF;
    let maxVariance = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;

      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      mB = sumB / wB;
      mF = (sum - sumB) / wF;

      const varianceBetween = wB * wF * Math.pow(mB - mF, 2);
      if (varianceBetween > maxVariance) {
        maxVariance = varianceBetween;
        threshold = t;
      }
    }

    return threshold;
  }

  async recognizeTextRegions(imageData: any, textRegions: { x: number, y: number, width: number, height: number }[]) {
    const canvas: HTMLCanvasElement = this.canvas;
    console.log('textRegions', textRegions);

    for (const region of textRegions) {
      const regionCanvas = document.createElement('canvas');
      regionCanvas.width = region.width;
      regionCanvas.height = region.height;
      const regionContext = regionCanvas.getContext('2d');

      const sourceImageData = imageData.data;
      const destinationImageData = regionContext?.createImageData(region.width, region.height).data || [];
      let destinationIndex = 0;

      for (let y = 0; y < region.height; y++) {
        for (let x = 0; x < region.width; x++) {
          const sourceIndex = ((region.y + y) * canvas.width + (region.x + x)) * 4;
          destinationImageData[destinationIndex] = sourceImageData[sourceIndex];
          destinationImageData[destinationIndex + 1] = sourceImageData[sourceIndex + 1];
          destinationImageData[destinationIndex + 2] = sourceImageData[sourceIndex + 2];
          destinationImageData[destinationIndex + 3] = sourceImageData[sourceIndex + 3];

          destinationIndex += 4;
        }
      }

      regionContext?.putImageData(new ImageData(destinationImageData as Uint8ClampedArray, region.width, region.height), 0, 0);

      // Recognize text in the region using Tesseract.js
      const result = await Tesseract.recognize(regionCanvas.toDataURL(), 'eng');
      console.log('OCR Result for Region:', result.data.text);
    }
  }

  thresholdImage(imageData: any, thresholdValue: number) {
    if (imageData) {
      const data = imageData.data;

      // Calculate the histogram
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const averageValue = (data[i] + data[i + 1] + data[i + 2]) / 3;
        histogram[Math.floor(averageValue)]++;
      }

      // Calculate the total number of pixels
      const totalPixels = imageData.width * imageData.height;
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
      }

      let sumB = 0;
      let wB = 0;
      let wF = 0;
      let mB;
      let mF;
      let maxVariance = 0;
      let threshold = 0;

      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;

        wF = totalPixels - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        mB = sumB / wB;
        mF = (sum - sumB) / wF;

        const varianceBetween = wB * wF * Math.pow(mB - mF, 2);
        if (varianceBetween > maxVariance) {
          maxVariance = varianceBetween;
          threshold = t;
        }
      }

      for (let i = 0; i < data.length; i += 4) {
        const averageValue = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const newValue = averageValue < threshold ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = newValue;
      }

      const context = this.canvas.getContext('2d');
      context.putImageData(imageData, 0, 0);
    }
  }

  async extractTextFromImage(image: Tesseract.ImageLike) {
    const result: Tesseract.RecognizeResult = await Tesseract.recognize(image);
    return result.data.text;
  }

  handleOnload(event: any) {
    console.log(event)
  }

  processDocument(text: string) {
    // ChatGPT API integration
    const apiUrl = 'YOUR_CHATGPT_API_URL'; // Replace with the actual ChatGPT API URL

    axios.post(apiUrl, {
      text: text
    })
      .then(response => {
        const category = response.data.category;
        const tags = response.data.tags;
        this.displayResults(category, tags);
      })
      .catch(err => {
        console.error('ChatGPT API Error:', err);
      });
  }

  displayResults(category: string, tags: string[]) {
    // Display the results on the screen as desired
    this.category = category;
    this.tags = tags;
  }
}
