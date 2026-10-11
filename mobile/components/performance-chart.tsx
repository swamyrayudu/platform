import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';
import { pieRotations } from '@/utils/progress-summary';
import { resultNumber } from '@/utils/result-summary';

// Two clipped, rotating half-discs draw an exact two-slice pie with native Views.
// No chart package, WebView, 160 tiny segments or new native module is needed.
export const PerformanceChart=memo(function PerformanceChart({accuracy,size,correct,remaining}:{accuracy:number;size:number;correct:number;remaining:number}) {
  const rotation=pieRotations(accuracy);
  const half=size/2;const hole=size*.7;
  return <View accessible accessibilityRole="image" accessibilityLabel={`Performance pie chart: ${correct} correct, ${remaining} wrong or skipped. Overall accuracy ${resultNumber(accuracy)} percent.`} style={{width:size,height:size,alignSelf:'center'}}>
    <View importantForAccessibility="no-hide-descendants" style={[styles.disc,{width:size,height:size,borderRadius:half,backgroundColor:colors.gold}]}>
      <View style={[styles.clip,{left:half,width:half,height:size}]}>
        <View style={[styles.disc,{left:-half,width:size,height:size,borderRadius:half,transform:[{rotate:`${rotation.right}deg`}]}]}>
          <View style={{width:half,height:size,backgroundColor:colors.green}}/>
        </View>
      </View>
      {rotation.left>0?<View style={[styles.clip,{left:0,width:half,height:size}]}>
        <View style={[styles.disc,{width:size,height:size,borderRadius:half,transform:[{rotate:`${rotation.left}deg`}]}]}>
          <View style={{position:'absolute',left:half,width:half,height:size,backgroundColor:colors.green}}/>
        </View>
      </View>:null}
      <View style={[styles.center,{left:(size-hole)/2,top:(size-hole)/2,width:hole,height:hole,borderRadius:hole/2}]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.value}>{resultNumber(accuracy)}%</Text><Text maxFontSizeMultiplier={1.2} style={styles.label}>correct</Text>
      </View>
    </View>
  </View>;
});
const styles=StyleSheet.create({
  disc:{position:'absolute',overflow:'hidden'},clip:{position:'absolute',overflow:'hidden'},
  center:{position:'absolute',alignItems:'center',justifyContent:'center',backgroundColor:colors.card,gap:2},
  value:{fontSize:25,lineHeight:34,fontWeight:'800',color:colors.primary},label:{fontSize:12,lineHeight:18,color:colors.muted},
});
