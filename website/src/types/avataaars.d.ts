declare module 'avataaars' {
  import { ComponentType, CSSProperties } from 'react';

  interface AvatarProps {
    avatarStyle?: 'Circle' | 'Transparent';
    style?: CSSProperties;
    topType?: string;
    accessoriesType?: string;
    hairColor?: string;
    facialHairType?: string;
    facialHairColor?: string;
    clotheType?: string;
    clotheColor?: string;
    eyeType?: string;
    eyebrowType?: string;
    mouthType?: string;
    skinColor?: string;
    [key: string]: any;
  }

  const Avatar: ComponentType<AvatarProps>;
  export default Avatar;
}
