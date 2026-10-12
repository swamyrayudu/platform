import { Image, type ImageProps } from 'react-native';

const logo = require('../assets/brand-mark.png');

/** Generated from the same vector logo used by the website. */
export function BrandMark({size = 36, onLoadEnd}: {size?:number;onLoadEnd?:ImageProps['onLoadEnd']}) {
  return <Image source={logo} accessible={false} resizeMode="contain" onLoadEnd={onLoadEnd}
    style={{width:size,height:size,flexShrink:0}}/>;
}
