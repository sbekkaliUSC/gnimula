"""Real topology-independent Magic/ngspice tools; expected logic belongs to tests."""
import copy,json,os,re,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'/'simulator'))
sys.path.insert(0,'/app')
from engineering import run_physical
from server import simulate
fixtures=Path(os.environ.get('GNIMULA_ENGINEERING_FIXTURES',str(Path(__file__).parent/'fixtures'/'engineering')))
class EngineeringTests(unittest.TestCase):
 def test_three_distinct_circuits_use_identical_tools(self):
  for kind,count in [('inverter',2),('xor',12),('nand',4)]:
   with self.subTest(circuit=kind):
    p=json.loads((fixtures/(kind+'.json')).read_text());pre=run_physical({**p,'action':'simulate'},simulate)['measurement']
    layout=run_physical({**p,'action':'generate_layout'},simulate)['layout'];post=run_physical({**p,'action':'simulate_extracted','layout':layout},simulate)
    self.assertEqual(post['extraction']['devices'],count);self.assertEqual(post['extraction']['drcErrors'],0);self.assertTrue(post['extraction']['connectivityMatches']);self.assertGreater(post['extraction']['parasiticCapacitors'],0)
    self.assertGreater(post['measurement']['worstDelayPs'],pre['worstDelayPs']);self.assertTrue(post['extraction']['gdsBase64'])
    samples=[5,15,25,35,45,55,65,75] if kind=='nand' else [10,30,50,70,90,110,130,150]
    for run in [pre,post['measurement']]:
     for ns in samples:
      row=min(run['rows'],key=lambda r:abs(r[0]-ns*1e-9));a=int(row[1]>.9);b=int(row[2]>.9) if kind!='inverter' else 0
      expected=(1-(a&b)) if kind=='nand' else (a^b if kind=='xor' else 1-a)
      self.assertTrue(row[-1]>1.44 if expected else row[-1]<.36,(kind,ns,row,expected))
 def test_broken_geometry_is_rejected(self):
  p=json.loads((fixtures/'inverter.json').read_text());layout=run_physical({**p,'action':'generate_layout'},simulate)['layout'];layout['shapes']=[s for s in layout['shapes'] if s['layer'] not in ['poly','polycont']]
  self.assertFalse(run_physical({**p,'action':'verify_layout','layout':layout},simulate)['extraction']['connectivityMatches'])
  with self.assertRaisesRegex(ValueError,'does not match'):run_physical({**p,'action':'simulate_extracted','layout':layout},simulate)
 def test_edited_load_and_analysis_are_used(self):
  p=json.loads((fixtures/'inverter.json').read_text());before=run_physical({**p,'action':'simulate'},simulate)['measurement'];p['netlist']=re.sub(r'^CL .*$', 'CL out 0 80e-15',p['netlist'],flags=re.M);p['analysis']['stop']=240e-9
  after=run_physical({**p,'action':'simulate'},simulate)['measurement'];self.assertGreater(after['worstDelayPs'],2*before['worstDelayPs']);self.assertGreater(after['rows'][-1][0],239e-9)
 def test_extracted_names_cannot_collide_with_external_load(self):
  p=json.loads((fixtures/'inverter.json').read_text());p['netlist']=re.sub(r'^CL ', 'C0 ',p['netlist'],flags=re.M)
  layout=run_physical({**p,'action':'generate_layout'},simulate)['layout'];result=run_physical({**p,'action':'simulate_extracted','layout':layout},simulate)
  names=[line.split()[0].lower() for line in result['extractedTestbench'].splitlines()[1:] if line and line[0].upper() in 'CVX']
  self.assertEqual(len(names),len(set(names)));self.assertIn('c0',names)
if __name__=='__main__':unittest.main()
