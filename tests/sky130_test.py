"""Run with GNIMULA_MODELS_DIR pointing at install_models.py output."""
import math
import os
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend/simulator'))
from server import simulate,validate_netlist

NET='''Gnimula generated circuit
Vdd n1 0 DC 1.8 AC 0 SIN(1.8 0 10000)
Vin in 0 DC 0.8 AC 1 SIN(0.8 0.01 10000)
R1 n1 out 10000
XM1 out in 0 0 sky130_fd_pr__nfet_01v8 W=4 L=0.5
C1 out 0 1e-11
.end
'''
class Sky130Tests(unittest.TestCase):
 def payload(self,netlist=NET):
  return dict(netlist=netlist,analysis=dict(mode='ac',start=10,stop=1e8,points=40),input='in',output='out',source='Vin')
 def test_real_foundry_model_has_finite_gain_and_responds_to_width(self):
  a=simulate(self.payload());b=simulate(self.payload(NET.replace('W=4','W=8')))
  self.assertIn('SKY130',a['model']);self.assertGreater(a['rows'][0][1],8);self.assertLess(a['rows'][0][1],15)
  self.assertGreater(abs(a['operatingOutput']-b['operatingOutput']),.1)
 def test_bulk_is_electrically_separate(self):
  base=NET.replace('XM1 out in 0 0','Vbody n2 0 DC -0.2\nXM1 out in 0 n2')
  self.assertGreater(abs(simulate(self.payload(base))['operatingOutput']-simulate(self.payload())['operatingOutput']),.01)
 def test_model_paths_and_uninstalled_devices_are_rejected(self):
  for changed in [NET.replace('.end','.include /etc/passwd\n.end'),NET.replace('sky130_fd_pr__nfet_01v8','anything_else')]:
   with self.assertRaises(ValueError):simulate(self.payload(changed))
if __name__=='__main__':unittest.main()
