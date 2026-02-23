import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import type { Team } from '../types';

interface TeamButtonsProps {
  homeTeam: Team;
  awayTeam: Team;
  onSelect: (teamId: string) => void;
  onSell: (teamId: string) => void;
}

const ID_STYLES: Record<string, { gradientColors: [string, string]; borderColor: string }> = {
  yes: { gradientColors: ['#09805A', '#006847'], borderColor: '#0DA36F' },
  no:  { gradientColors: ['#C62828', '#B71C1C'], borderColor: '#E53935' },
};

// keyword → primary team colors  (NBA / NFL / NHL / MLB)
const TEAM_COLORS: Array<{ keywords: string[]; gradientColors: [string, string]; borderColor: string }> = [
  // ── NBA ──────────────────────────────────────────────────────────────
  { keywords: ['lakers'],         gradientColors: ['#702BA4', '#4B1D87'], borderColor: '#FDB927' },
  { keywords: ['clippers'],       gradientColors: ['#C8102E', '#1D428A'], borderColor: '#C8102E' },
  { keywords: ['celtics'],        gradientColors: ['#007A33', '#00581F'], borderColor: '#00A847' },
  { keywords: ['warriors', 'golden state'], gradientColors: ['#1D428A', '#1D428A'], borderColor: '#FFC72C' },
  { keywords: ['bulls'],          gradientColors: ['#CE1141', '#A50A2C'], borderColor: '#E8254F' },
  { keywords: ['knicks'],         gradientColors: ['#006BB6', '#004B8D'], borderColor: '#F58426' },
  { keywords: ['nets', 'brooklyn'], gradientColors: ['#2B2B2B', '#000000'], borderColor: '#5A5A5A' },
  { keywords: ['heat'],           gradientColors: ['#98002E', '#6D0020'], borderColor: '#F9A01B' },
  { keywords: ['76ers', 'sixers', 'philadelphia'], gradientColors: ['#006BB6', '#004B8D'], borderColor: '#ED174C' },
  { keywords: ['raptors'],        gradientColors: ['#CE1141', '#A50A2C'], borderColor: '#FF3A5C' },
  { keywords: ['bucks', 'milwaukee'], gradientColors: ['#00471B', '#003312'], borderColor: '#00B944' },
  { keywords: ['nuggets', 'denver'], gradientColors: ['#0E2240', '#0E2240'], borderColor: '#FEC524' },
  { keywords: ['timberwolves'],   gradientColors: ['#0C2340', '#236192'], borderColor: '#78BE20' },
  { keywords: ['thunder', 'oklahoma'], gradientColors: ['#007AC1', '#005E99'], borderColor: '#F9A01B' },
  { keywords: ['trail blazers', 'blazers', 'portland'], gradientColors: ['#E03A3E', '#B82D31'], borderColor: '#F56060' },
  { keywords: ['jazz', 'utah'],   gradientColors: ['#00471B', '#1D1160'], borderColor: '#F9A01B' },
  { keywords: ['suns', 'phoenix'], gradientColors: ['#1D1160', '#1D1160'], borderColor: '#E56020' },
  { keywords: ['kings', 'sacramento'], gradientColors: ['#5A2D81', '#3E1F5A'], borderColor: '#7B4EAB' },
  { keywords: ['hawks', 'atlanta'], gradientColors: ['#E03A3E', '#B82D31'], borderColor: '#C1D32F' },
  { keywords: ['hornets', 'charlotte'], gradientColors: ['#1D1160', '#00788C'], borderColor: '#A1A1C2' },
  { keywords: ['cavaliers', 'cleveland'], gradientColors: ['#6F2633', '#4F1A24'], borderColor: '#FFB81C' },
  { keywords: ['pistons', 'detroit'], gradientColors: ['#C8102E', '#1D428A'], borderColor: '#C8102E' },
  { keywords: ['pacers', 'indiana'], gradientColors: ['#002D62', '#001A3B'], borderColor: '#FDBB30' },
  { keywords: ['magic', 'orlando'], gradientColors: ['#0077C0', '#005A91'], borderColor: '#C4CED4' },
  { keywords: ['wizards'],        gradientColors: ['#002B5C', '#001A3B'], borderColor: '#E31837' },
  { keywords: ['grizzlies', 'memphis'], gradientColors: ['#5D76A9', '#12173F'], borderColor: '#F5B112' },
  { keywords: ['pelicans', 'new orleans'], gradientColors: ['#0C2340', '#C8102E'], borderColor: '#85714D' },
  { keywords: ['rockets', 'houston'], gradientColors: ['#CE1141', '#A50A2C'], borderColor: '#E8254F' },
  { keywords: ['mavericks', 'dallas'], gradientColors: ['#00538C', '#00375E'], borderColor: '#0064B1' },
  { keywords: ['spurs', 'san antonio'], gradientColors: ['#3A3A3A', '#1A1A1A'], borderColor: '#C4CED4' },
  { keywords: ['okc'],            gradientColors: ['#007AC1', '#005E99'], borderColor: '#F9A01B' },

  // ── NFL ──────────────────────────────────────────────────────────────
  { keywords: ['patriots', 'new england'], gradientColors: ['#002244', '#001533'], borderColor: '#C60C30' },
  { keywords: ['chiefs', 'kansas city'], gradientColors: ['#E31837', '#B31229'], borderColor: '#FFB81C' },
  { keywords: ['cowboys'],        gradientColors: ['#041E42', '#02122B'], borderColor: '#869397' },
  { keywords: ['packers', 'green bay'], gradientColors: ['#203731', '#122219'], borderColor: '#FFB612' },
  { keywords: ['bears'],          gradientColors: ['#0B162A', '#020915'], borderColor: '#C83803' },
  { keywords: ['giants', 'new york g'], gradientColors: ['#0B2265', '#061445'], borderColor: '#A71930' },
  { keywords: ['eagles'],         gradientColors: ['#004C54', '#002D33'], borderColor: '#ACC0C6' },
  { keywords: ['49ers', 'san francisco'], gradientColors: ['#AA0000', '#7A0000'], borderColor: '#B3995D' },
  { keywords: ['seahawks', 'seattle'], gradientColors: ['#002244', '#001533'], borderColor: '#69BE28' },
  { keywords: ['rams'],           gradientColors: ['#003594', '#002266'], borderColor: '#FFA300' },
  { keywords: ['ravens', 'baltimore'], gradientColors: ['#241773', '#150D45'], borderColor: '#9E7C0C' },
  { keywords: ['steelers', 'pittsburgh'], gradientColors: ['#101820', '#000000'], borderColor: '#FFB612' },
  { keywords: ['broncos'],        gradientColors: ['#002244', '#001533'], borderColor: '#FB4F14' },
  { keywords: ['chargers'],       gradientColors: ['#0080C6', '#005E96'], borderColor: '#FFC20E' },
  { keywords: ['raiders', 'las vegas'], gradientColors: ['#1A1A1A', '#000000'], borderColor: '#A5ACAF' },
  { keywords: ['bills', 'buffalo'], gradientColors: ['#00338D', '#00235E'], borderColor: '#C60C30' },
  { keywords: ['dolphins'],       gradientColors: ['#008E97', '#006B72'], borderColor: '#FC4C02' },
  { keywords: ['jets'],           gradientColors: ['#125740', '#0B3D2D'], borderColor: '#125740' },
  { keywords: ['texans'],         gradientColors: ['#03202F', '#011319'], borderColor: '#A71930' },
  { keywords: ['colts', 'indianapolis'], gradientColors: ['#002C5F', '#001A3B'], borderColor: '#A2AAAD' },
  { keywords: ['jaguars', 'jacksonville'], gradientColors: ['#101820', '#000000'], borderColor: '#9F792C' },
  { keywords: ['titans', 'tennessee'], gradientColors: ['#0C2340', '#061528'], borderColor: '#4B92DB' },
  { keywords: ['bengals', 'cincinnati'], gradientColors: ['#FB4F14', '#C33B0C'], borderColor: '#FB4F14' },
  { keywords: ['browns'],         gradientColors: ['#311D00', '#1A0F00'], borderColor: '#FF3C00' },
  { keywords: ['falcons'],        gradientColors: ['#A71930', '#7A1222'], borderColor: '#A71930' },
  { keywords: ['saints'],         gradientColors: ['#101820', '#000000'], borderColor: '#D3BC8D' },
  { keywords: ['buccaneers', 'tampa bay'], gradientColors: ['#D50A0A', '#A20808'], borderColor: '#D50A0A' },
  { keywords: ['cardinals', 'arizona'], gradientColors: ['#97233F', '#6B1A2E'], borderColor: '#97233F' },
  { keywords: ['vikings', 'minnesota'], gradientColors: ['#4F2683', '#351A5A'], borderColor: '#FFC62F' },
  { keywords: ['lions'],          gradientColors: ['#0076B6', '#00598A'], borderColor: '#B0B7BC' },
  { keywords: ['commanders', 'washington'], gradientColors: ['#5A1414', '#3B0D0D'], borderColor: '#FFB612' },
  { keywords: ['panthers', 'carolina'], gradientColors: ['#0085CA', '#00639A'], borderColor: '#0085CA' },

  // ── NHL ──────────────────────────────────────────────────────────────
  { keywords: ['rangers'],        gradientColors: ['#0038A8', '#002680'], borderColor: '#CE1126' },
  { keywords: ['penguins'],       gradientColors: ['#000000', '#000000'], borderColor: '#FCB514' },
  { keywords: ['bruins'],         gradientColors: ['#1A1A00', '#000000'], borderColor: '#FFB81C' },
  { keywords: ['canadiens', 'montreal'], gradientColors: ['#AF1E2D', '#7D1520'], borderColor: '#003E7E' },
  { keywords: ['maple leafs', 'toronto'], gradientColors: ['#00205B', '#001235'], borderColor: '#00205B' },
  { keywords: ['blackhawks'],     gradientColors: ['#CF0A2C', '#9B0820'], borderColor: '#CF0A2C' },
  { keywords: ['red wings'],      gradientColors: ['#CE1126', '#9C0D1C'], borderColor: '#CE1126' },
  { keywords: ['lightning'],      gradientColors: ['#002868', '#001745'], borderColor: '#002868' },
  { keywords: ['capitals'],       gradientColors: ['#C8102E', '#041E42'], borderColor: '#C8102E' },
  { keywords: ['flyers'],         gradientColors: ['#F74902', '#C23702'], borderColor: '#F74902' },
  { keywords: ['golden knights', 'vegas'], gradientColors: ['#333F42', '#1E2528'], borderColor: '#B4975A' },
  { keywords: ['avalanche', 'colorado c'], gradientColors: ['#6F263D', '#4F1C2C'], borderColor: '#236192' },
  { keywords: ['flames', 'calgary'], gradientColors: ['#C8102E', '#9C0D1C'], borderColor: '#F1BE48' },
  { keywords: ['oilers', 'edmonton'], gradientColors: ['#041E42', '#FF4C00'], borderColor: '#FF4C00' },
  { keywords: ['canucks', 'vancouver'], gradientColors: ['#001F5B', '#00153F'], borderColor: '#00843D' },
  { keywords: ['sharks', 'san jose'], gradientColors: ['#006D75', '#004D54'], borderColor: '#EA7200' },
  { keywords: ['ducks', 'anaheim'], gradientColors: ['#1A1A1A', '#000000'], borderColor: '#F47A38' },
  { keywords: ['stars'],          gradientColors: ['#006847', '#004D34'], borderColor: '#006847' },
  { keywords: ['blues', 'st. louis'], gradientColors: ['#002F87', '#001D55'], borderColor: '#FCB514' },
  { keywords: ['predators', 'nashville'], gradientColors: ['#041E42', '#02122B'], borderColor: '#FFB81C' },
  { keywords: ['hurricanes'],     gradientColors: ['#CC0000', '#990000'], borderColor: '#CC0000' },
  { keywords: ['sabres'],         gradientColors: ['#002654', '#001533'], borderColor: '#FCB514' },
  { keywords: ['devils', 'new jersey'], gradientColors: ['#CE1126', '#9C0D1C'], borderColor: '#CE1126' },
  { keywords: ['islanders'],      gradientColors: ['#00539B', '#003D74'], borderColor: '#F47D30' },
  { keywords: ['blue jackets', 'columbus'], gradientColors: ['#002654', '#001533'], borderColor: '#CE1126' },
  { keywords: ['wild'],           gradientColors: ['#154734', '#0C2D21'], borderColor: '#EAAA00' },
  { keywords: ['kraken'],         gradientColors: ['#001628', '#000E1A'], borderColor: '#68A2B9' },
  { keywords: ['senators', 'ottawa'], gradientColors: ['#C52032', '#961828'], borderColor: '#C69214' },

  // ── MLB ──────────────────────────────────────────────────────────────
  { keywords: ['yankees'],        gradientColors: ['#003087', '#001D54'], borderColor: '#003087' },
  { keywords: ['red sox'],        gradientColors: ['#BD3039', '#8A2229'], borderColor: '#BD3039' },
  { keywords: ['dodgers'],        gradientColors: ['#005A9C', '#003E6D'], borderColor: '#005A9C' },
  { keywords: ['cubs'],           gradientColors: ['#0E3386', '#091F52'], borderColor: '#CC3433' },
  { keywords: ['white sox'],      gradientColors: ['#27251F', '#100F0A'], borderColor: '#C4CED4' },
  { keywords: ['astros'],         gradientColors: ['#002D62', '#001A3B'], borderColor: '#EB6E1F' },
  { keywords: ['mets'],           gradientColors: ['#002D72', '#001A45'], borderColor: '#FF5910' },
  { keywords: ['braves'],         gradientColors: ['#CE1141', '#A50A2C'], borderColor: '#13274F' },
  { keywords: ['angels', 'anaheim a'], gradientColors: ['#BA0021', '#8A0018'], borderColor: '#BA0021' },
];

function getTeamColors(name: string): { gradientColors: [string, string]; borderColor: string } {
  const lower = name.toLowerCase();
  for (const entry of TEAM_COLORS) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      return { gradientColors: entry.gradientColors, borderColor: entry.borderColor };
    }
  }
  return { gradientColors: ['#1e3248', '#0d1f33'], borderColor: '#3a5a7a' };
}

function BuyButton({
  team,
  onPress,
}: {
  team: Team;
  onPress: () => void;
}) {
  const config = ID_STYLES[team.id] ?? getTeamColors(team.name);

  return (
    <Pressable
      style={({ pressed }) => [styles.buyPressable, pressed ? styles.buttonPressed : undefined]}
      onPress={onPress}
    >
      <View style={styles.outerRing}>
        <LinearGradient
          colors={config.gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.button, { borderColor: config.borderColor }]}
        >
          <Text style={styles.buttonText}>
            {team.city ? `${team.city} ${team.name}` : team.name}
          </Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function SellButton({ onPress, size }: { onPress: () => void; size: number }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sellPressable,
        size > 0 ? { width: size } : undefined,
        pressed ? styles.buttonPressed : undefined,
      ]}
      onPress={onPress}
    >
      <View style={[styles.outerRing, styles.sellOuter]}>
        <LinearGradient
          colors={['#F63658', '#B71431']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.button, styles.sellButton]}
        >
          <Text style={styles.sellText}>SELL</Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export function TeamButtons({ homeTeam, awayTeam, onSelect, onSell }: TeamButtonsProps) {
  const [rowH, setRowH] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Buy outcome</Text>
      <View
        style={styles.row}
        onLayout={(e) => setRowH(e.nativeEvent.layout.height)}
      >
        <BuyButton team={homeTeam} onPress={() => onSelect(homeTeam.id)} />
        <SellButton onPress={() => onSell(homeTeam.id)} size={rowH} />
      </View>
      <View style={styles.row}>
        <BuyButton team={awayTeam} onPress={() => onSelect(awayTeam.id)} />
        <SellButton onPress={() => onSell(awayTeam.id)} size={rowH} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginBottom: 24,
  },
  heading: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  buyPressable: {
    flex: 1,
  },
  sellPressable: {
    alignSelf: 'stretch',
  },
  outerRing: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 2,
    backgroundColor: '#101010',
  },
  sellOuter: {
    flex: 1,
  },
  button: {
    paddingVertical: 25,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButton: {
    flex: 1,
    paddingVertical: 0,
    borderColor: '#FF637F',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  sellText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
});
