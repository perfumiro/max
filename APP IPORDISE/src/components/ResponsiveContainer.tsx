import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../useResponsiveLayout';

export function ResponsiveContainer({children,maxWidth,style,noGutter=false}:{children:React.ReactNode;maxWidth?:number;style?:StyleProp<ViewStyle>;noGutter?:boolean}) {
  const layout=useResponsiveLayout();
  return <View style={[styles.base,{maxWidth:(maxWidth ?? layout.contentMaxWidth)+(noGutter?0:layout.gutter*2),paddingHorizontal:noGutter?0:layout.gutter},style]}>{children}</View>;
}

const styles=StyleSheet.create({base:{width:'100%',alignSelf:'center'}});
