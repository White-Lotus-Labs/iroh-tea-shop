import {test,expect} from '@playwright/test';
test('complete ritual twice, evidence, input preservation and card privacy',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Pour what you have already written.'})).toBeVisible({timeout:15000});
  for(let turn=0;turn<2;turn++){
    await page.getByRole('button',{name:'Load sample',exact:true}).click();
    const thesis=await page.getByLabel('Your finished thesis').inputValue();
    await page.getByRole('button',{name:'Pour',exact:true}).dblclick();
    await expect(page.getByRole('button',{name:'Pouring…',exact:true})).toBeDisabled();
    await expect(page.getByRole('heading',{name:'A little clarity, with your tea.'})).toBeVisible();
    await page.getByRole('button',{name:'Inspect evidence · DEMO-E-01'}).click();
    await expect(page.getByRole('dialog')).toContainText('$1,200,000');
    await expect(page.getByRole('dialog')).toContainText('capped');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Take one breath',exact:true}).click();
    await expect(page.getByRole('heading',{name:'One breath before you go.'})).toBeVisible();
    await page.getByRole('button',{name:'Keep this reflection',exact:true}).click();
    await expect(page.getByTestId('share-card')).toContainText('DEMO DATA');
    await expect(page.getByTestId('share-card')).not.toContainText(thesis);
    await page.getByRole('button',{name:'Pour another thesis',exact:true}).click();
    await expect(page.getByLabel('Your finished thesis')).toHaveValue(thesis);
  }
  expect(errors).toEqual([]);
});
test('keyboard forms, navigation, cancellation and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const thesis=page.getByLabel('Your finished thesis');
  await expect(thesis).toBeVisible();
  await thesis.fill('Short');
  await page.getByRole('button',{name:'Pour',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('80');
  await expect(thesis).toHaveValue('Short');
  await page.getByRole('button',{name:'Load sample',exact:true}).click();
  await thesis.focus();
  await page.keyboard.press('End');
  await page.keyboard.type(' wasd');
  await expect(page.getByRole('heading',{name:'Pour what you have already written.'})).toBeVisible();
  await page.getByRole('button',{name:'Pour',exact:true}).click();
  await page.getByRole('button',{name:'Cancel review',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pour',exact:true})).toBeEnabled();
  for(const name of ['Entrance','Tea table','Host','Shelf','Counter']){
    await page.getByRole('navigation',{name:'Tea room stations'}).getByRole('button',{name:new RegExp(name)}).click();
    await expect(page.getByRole('navigation',{name:'Tea room stations'}).getByRole('button',{name:new RegExp(name)})).toHaveAttribute('aria-current','step');
  }
  await expect(thesis).toHaveValue(/wasd$/);
});
