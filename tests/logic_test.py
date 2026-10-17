"""Run in the simulator image: real Magic + ngspice, no stored expected curves."""
import copy,json,os,re,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'/'simulator'))
sys.path.insert(0,'/app')
from logic import run_physical
from server import simulate
fixtures=Path(os.environ.get('GNIMULA_LOGIC_FIXTURES',str(Path(__file__).parent/'fixtures'/'logic')))
class PhysicalLogicTests(unittest.TestCase):
 def test_real_inverter_and_xor_flow(self):
  for kind,count in [('inverter',2),('xor',12)]:
   with self.subTest(kind=kind):
    p=json.loads((fixtures/(kind+'.json')).read_text())
    pre=run_physical({**p,'action':'prelayout'},simulate)['measurement']
    layout=run_physical({**p,'action':'layout'},simulate)['layout']
    post=run_physical({**p,'action':'postlayout','layout':layout},simulate)
    self.assertEqual(post['extraction']['devices'],count)
    self.assertEqual(post['extraction']['drcErrors'],0)
    self.assertTrue(post['extraction']['connectivityMatches'])
    self.assertGreater(post['extraction']['parasiticCapacitors'],0)
    self.assertTrue(pre['truthPassed']);self.assertTrue(post['measurement']['truthPassed'])
    self.assertGreater(post['measurement']['worstDelayPs'],pre['worstDelayPs'])
    self.assertTrue(post['extraction']['gdsBase64'])
 def test_broken_geometry_cannot_reuse_schematic_as_postlayout(self):
  p=json.loads((fixtures/'inverter.json').read_text());layout=run_physical({**p,'action':'layout'},simulate)['layout']
  layout['shapes']=[s for s in layout['shapes'] if s['layer'] not in ['poly','polycont']]
  result=run_physical({**p,'action':'verify','layout':layout},simulate)
  self.assertFalse(result['extraction']['connectivityMatches'])
  with self.assertRaisesRegex(ValueError,'does not match'):
   run_physical({**p,'action':'postlayout','layout':layout},simulate)
 def test_load_changes_are_measured(self):
  p=json.loads((fixtures/'inverter.json').read_text());before=run_physical({**p,'action':'prelayout'},simulate)['measurement']
  p['netlist']=re.sub(r'^CL .*$', 'CL out 0 80e-15',p['netlist'],flags=re.M)
  after=run_physical({**p,'action':'prelayout'},simulate)['measurement']
  self.assertTrue(after['truthPassed']);self.assertGreater(after['worstDelayPs'],2*before['worstDelayPs'])
if __name__=='__main__':unittest.main()
