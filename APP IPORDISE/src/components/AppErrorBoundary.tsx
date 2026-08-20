import React, { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logger } from '../observability/logger';

type State = { failed: boolean };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('unhandled_render_error', error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.screen} accessibilityRole="alert"><View style={styles.mark}><Text style={styles.markText}>I</Text></View><Text style={styles.eyebrow}>IPORDISE CARE</Text><Text style={styles.title}>Something went wrong.</Text><Text style={styles.copy}>Your shopping data is safe. Try reopening this screen to continue.</Text><Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;
  }
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f6f3f1',alignItems:'center',justifyContent:'center',padding:28},
  mark:{width:52,height:52,borderRadius:17,backgroundColor:'#d7193f',alignItems:'center',justifyContent:'center',marginBottom:20},
  markText:{fontFamily:'serif',fontSize:25,fontWeight:'700',color:'#fff'},
  eyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.7,color:'#d7193f'},
  title:{fontFamily:'serif',fontSize:28,lineHeight:34,fontWeight:'700',color:'#171310',marginTop:6,textAlign:'center'},
  copy:{fontSize:12,lineHeight:18,color:'#706661',textAlign:'center',maxWidth:340,marginTop:7},
  button:{height:48,borderRadius:24,backgroundColor:'#171310',paddingHorizontal:28,alignItems:'center',justifyContent:'center',marginTop:22},
  buttonText:{fontSize:12,fontWeight:'900',color:'#fff'},pressed:{opacity:.75,transform:[{scale:.98}]},
});
