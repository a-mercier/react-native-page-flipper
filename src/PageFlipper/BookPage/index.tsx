import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  WithTimingConfig,
} from 'react-native-reanimated';
import Image from '../Components/Image';
import { Page, Size } from '../types';
import BackShadow from './BackShadow';
import FrontShadow from './FrontShadow';
import PageShadow from './PageShadow';
import { BookSpine } from './BookSpine';
import { BookSpine2 } from './BookSpine2';
import { clamp, snapPoint } from '../utils/utils';
export type IBookPageProps = {
  right: boolean;
  front: Page;
  back: Page;
  onPageFlip: any;
  containerSize: Size;
  isAnimatingRef: React.MutableRefObject<boolean>;
  setIsAnimating: (val: boolean) => void;
  isAnimating: boolean;
  enabled: boolean;
  getBookImageStyle: (right: boolean, front: boolean) => any;
  single: boolean;
  onFlipStart?: () => void;
};

export type BookPageInstance = {
  turnPage: () => void;
};

const timingConfig: WithTimingConfig = {
  duration: 800,
  easing: Easing.inOut(Easing.cubic),
};

const BookPage = React.forwardRef<BookPageInstance, IBookPageProps>(
  (
    {
      right,
      front,
      back,
      onPageFlip,
      containerSize,
      isAnimatingRef,
      setIsAnimating,
      isAnimating,
      enabled,
      getBookImageStyle,
      single,
      onFlipStart,
    },
    ref,
  ) => {
    const x = useSharedValue(0);
    const isMounted = useRef(false);
    const rotateYAsDeg = useSharedValue(0);
    const [isDragging, setIsDragging] = useState(false);
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;
    const leftPSnapPoints = [0, containerWidth];
    const rightPSnapPoints = [-containerWidth, 0];
    const pSnapPoints = right ? rightPSnapPoints : leftPSnapPoints;
    const gesturesEnabled = enabled && !isAnimating;
    const showSpine = true;

    // might not need this useEffect
    // useEffect(() => {
    //   if (!enabled) {
    //     setIsDragging(false);
    //   }
    // }, [enabled]);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const turnPage = () => {
      setIsDragging(true);
      setIsAnimating(true);
      if (onFlipStart && typeof onFlipStart === 'function') {
        onFlipStart();
      }
      const id = right ? 1 : -1;
      rotateYAsDeg.value = withTiming(right ? 180 : -180, timingConfig, () => {
        runOnJS(onPageFlip)(id, false);
      });
    };

    React.useImperativeHandle(
      ref,
      () => ({
        turnPage,
      }),
      [turnPage],
    );

    const onDrag = useCallback((val: boolean) => {
      if (!isMounted.current) {
        return;
      }
      if (val) {
        setIsDragging(true);
      } else {
        setIsDragging(false);
      }
    }, []);

    const backStyle = useAnimatedStyle(() => {
      const degrees = rotateYAsDeg.value;
      const x = right
        ? interpolate(degrees, [0, 180], [containerWidth / 2, -containerWidth / 2])
        : interpolate(degrees, [-180, 0], [containerWidth / 2, 0]);

      const w = right
        ? interpolate(degrees, [0, 180], [0, containerWidth / 2])
        : interpolate(degrees, [-180, 0], [containerWidth / 2, 0]);
      return {
        width: Math.ceil(w),
        zIndex: 2,
        transform: [{ translateX: x }],
      };
    });

    const frontStyle = useAnimatedStyle(() => {
      const degrees = rotateYAsDeg.value;

      const w = right
        ? interpolate(degrees, [0, 90], [containerWidth / 2, 0], Extrapolate.CLAMP)
        : interpolate(degrees, [-90, 0], [0, containerWidth / 2], Extrapolate.CLAMP);

      const style: ViewStyle = {
        zIndex: 1,
        width: Math.floor(w),
      };

      if (right) {
        style['left'] = 0;
      } else {
        style['right'] = 0;
      }

      return style;
    });

    const containerStyle = useAnimatedStyle(() => {
      return {
        flex: 1,
        // backgroundColor: 'white',
        zIndex: isDragging ? 100 : 0,
      };
    });

    const animatedBackImageStyle = useAnimatedStyle(() => {
      const l = right
        ? 0
        : interpolate(
            rotateYAsDeg.value,
            [-180, 0],
            single ? [0, -containerWidth / 2] : [-containerWidth / 2, -containerWidth],
          );

      return {
        left: l,
      };
    });

    const onPanGestureHandler = useAnimatedGestureHandler<
      PanGestureHandlerGestureEvent,
      { x: number }
    >({
      onStart: (event, ctx) => {
        runOnJS(onDrag)(true);
        ctx.x = x.value;
      },
      onActive: (event, ctx) => {
        x.value = ctx.x + event.translationX;
        rotateYAsDeg.value = interpolate(
          x.value,
          [-containerWidth, 0, containerWidth],
          [180, 0, -180],
          Extrapolate.CLAMP,
        );
      },
      onEnd: (event) => {
        const snapTo = snapPoint(x.value, event.velocityX, pSnapPoints);
        const id = snapTo > 0 ? -1 : snapTo < 0 ? 1 : 0;
        const degrees = snapTo > 0 ? -180 : snapTo < 0 ? 180 : 0;
        x.value = snapTo;

        if (rotateYAsDeg.value === degrees) {
          runOnJS(onPageFlip)(id, false);
        } else {
          runOnJS(setIsAnimating)(true);

          const progress = Math.abs(rotateYAsDeg.value - degrees) / 100;
          const duration = clamp(800 * progress - Math.abs(0.1 * event.velocityX), 350, 1000);

          rotateYAsDeg.value = withTiming(
            degrees,
            {
              ...timingConfig,
              duration: duration,
            },
            () => {
              if (snapTo === 0) {
                runOnJS(onDrag)(false);
              }
              runOnJS(onPageFlip)(id, false);
            },
          );
        }
      },
    });

    if (!front || !back) {
      return null;
    }

    const frontImageStyle = getBookImageStyle(right, true);
    const backImageStyle = getBookImageStyle(right, false);

    const frontUrl = right ? front.right : front.left;
    const backUrl = right ? back.left : back.right;
    return (
      <PanGestureHandler onGestureEvent={onPanGestureHandler} enabled={gesturesEnabled}>
        <Animated.View style={containerStyle}>
          <Pressable
            disabled={isAnimating}
            onPress={() => {
              if (!isAnimatingRef.current) turnPage();
            }}
            style={[
              {
                position: 'absolute',
                height: '100%',
                width: '50%',
                zIndex: 10000,
              },
              right ? { right: 0 } : { left: 0 },
            ]}
          />

          {/* BACK */}
          <Animated.View style={[styles.imageContainer, backStyle, { overflow: 'visible' }]}>
            <View style={styles.imageContainer}>
              {backUrl ? (
                <Image
                  source={{
                    uri: backUrl,
                  }}
                  style={[backImageStyle, animatedBackImageStyle]}
                />
              ) : (
                <BlankPage />
              )}
            </View>

            <BackShadow {...{ degrees: rotateYAsDeg, right }} />
            <FrontShadow
              {...{
                right,
                degrees: rotateYAsDeg,
                width: containerWidth,
                viewHeight: containerHeight,
              }}
            />

            <PageShadow
              {...{
                right,
                degrees: rotateYAsDeg,
                width: containerWidth,
                viewHeight: containerHeight,
                containerSize,
              }}
            />

            {showSpine && (
              <BookSpine2 right={right} degrees={rotateYAsDeg} containerSize={containerSize} />
            )}
          </Animated.View>
          {/* FRONT */}
          <Animated.View style={[styles.imageContainer, frontStyle]}>
            {frontUrl ? (
              <Image
                source={{
                  uri: frontUrl,
                }}
                style={[frontImageStyle]}
              />
            ) : (
              <BlankPage />
            )}
            {showSpine && <BookSpine right={right} containerSize={containerSize} />}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    );
  },
);

export { BookPage };

const BlankPage = () => (
  <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#fff' }} />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    // justifyContent: 'center',
    // alignItems: 'flex-end',
    // backgroundColor: 'rgba(0,0,0,0)',
    // backgroundColor: 'white',
  },
});
