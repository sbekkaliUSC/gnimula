"""Numerical and boundary checks for the actual ngspice integration."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend/simulator'))
from server import simulate,validate_netlist

NET='''Gnimula generated circuit
Vin in 0 DC 1 AC 1 SIN(1 0.1 1000)
R1 in out 1000
C1 out 0 1e-6
.end
'''
class SimulatorTests(unittest.TestCase):
 def payload(self,mode='ac'):
  return dict(netlist=NET,analysis=dict(mode=mode,start=10,stop=10000,points=40),input='in',output='out',source='Vin')
 def test_rc_ac_matches_transfer_function(self):
  r=simulate(self.payload())
  for f,db,phase in r['rows'][::20]:
   expected=-10*math.log10(1+(2*math.pi*f*.001)**2)
   self.assertAlmostEqual(db,expected,places=5)
   self.assertAlmostEqual(phase,-math.atan(2*math.pi*f*.001),places=5)
 def test_gain_independent_of_excitation_amplitude(self):
  p=self.payload();a=simulate(p);p['netlist']=NET.replace('AC 1','AC 0.5');b=simulate(p)
  self.assertAlmostEqual(a['rows'][0][1],b['rows'][0][1],places=6)
 def test_dc_transfer(self):
  p=self.payload('dc');p['analysis'].update(start=0,stop=3)
  r=simulate(p)
  for x,y in r['rows']:self.assertAlmostEqual(x,y,places=6)
 def test_transient_returns_real_samples(self):
  p=self.payload('tran');p['analysis'].update(start=0,stop=.005)
  r=simulate(p);self.assertGreater(len(r['rows']),500);self.assertGreater(max(x[1] for x in r['rows'])-min(x[1] for x in r['rows']),.005)
 def test_hierarchical_waveform_matches_flat_circuit(self):
  p=self.payload('tran');p['analysis'].update(start=0,stop=.008)
  p['netlist']=NET.replace('DC 1 AC 1 SIN(1 0.1 1000)','DC 0 AC 1 PULSE(0 1 0 1u 1u 2m 4m)')
  flat=simulate(p)
  p['netlist']=p['netlist'].replace('R1 in out 1000\nC1 out 0 1e-6','X1 in out 0 filter\n.subckt filter a z g params: r=1000\nR1 a z {r}\nC1 z g 1e-6\n.ends filter')
  hierarchical=simulate(p)
  self.assertEqual(len(flat['rows']),len(hierarchical['rows']))
  for a,b in zip(flat['rows'],hierarchical['rows']):self.assertAlmostEqual(a[1],b[1],places=8)
 def test_bjt_model_card_is_preserved_and_runs(self):
  p=self.payload('dc');p['analysis'].update(start=.5,stop=.9)
  p['netlist']='Gnimula generated circuit\nVin in 0 0.7\nVdd rail 0 3.3\nR1 rail out 1k\nQ1 out in 0 npn_local\n.model npn_local NPN (IS=1e-14 BF=100)\n.end'
  r=simulate(p);self.assertGreater(len(r['rows']),20);self.assertGreater(r['rows'][0][1],r['rows'][-1][1])
 def test_rejects_directives_and_unbounded_work(self):
  with self.assertRaises(ValueError):validate_netlist(NET.replace('.end','.control\nshell cat /etc/passwd\n.endc\n.end'))
  p=self.payload('tran');p['analysis']['stop']=1000
  with self.assertRaises(ValueError):simulate(p)
if __name__=='__main__':unittest.main()
