import { Heading } from '@/components/heading';
import type { ComponentProps } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/utils/theme';
import { Button } from './ui';

type Props={title:string;description:string;notice?:string;cancelLabel:string;confirmLabel:string;busy?:boolean;icon:ComponentProps<typeof Ionicons>['name'];onCancel:()=>void;onConfirm:()=>void};
export function AlertDialog({title,description,notice,cancelLabel,confirmLabel,busy=false,icon,onCancel,onConfirm}:Props) {
  const {width,fontScale}=useWindowDimensions();
  const stacked=Math.min(440,width-32)-40<280*Math.max(1,fontScale);
  const cancel=()=>{if(!busy)onCancel();};
  return <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={cancel}>
    <SafeAreaView style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} bounces={false}>
        <View accessibilityViewIsModal onAccessibilityEscape={cancel} style={styles.panel}>
          <View style={styles.intro}><View style={styles.icon}><Ionicons name={icon} size={24} color={colors.primary}/></View>{notice?<Text style={styles.notice}>{notice}</Text>:null}</View>
          <Heading style={styles.title}>{title}</Heading>
          <Text style={styles.description}>{description}</Text>
          <View style={[styles.actions,{flexDirection:stacked?'column':'row'}]}>
            <View style={[styles.action,stacked&&styles.stackedAction]}><Button secondary label={cancelLabel} disabled={busy} onPress={cancel}/></View>
            <View style={[styles.action,stacked&&styles.stackedAction]}><Button label={confirmLabel} busy={busy} onPress={onConfirm}/></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(27,26,46,.55)'},container:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:16},
  panel:{width:'100%',maxWidth:440,padding:20,gap:12,borderRadius:22,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},
  icon:{width:46,height:46,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.primarySoft},
  intro:{flexDirection:'row',alignItems:'center',gap:10},notice:{flexShrink:1,fontSize:12,lineHeight:19,color:colors.muted},
  title:{},description:{fontSize:14,lineHeight:23,color:colors.muted},
  actions:{gap:10,marginTop:8},action:{flexGrow:1,flexBasis:0,minWidth:0},stackedAction:{flexGrow:0,flexBasis:'auto'},
});
