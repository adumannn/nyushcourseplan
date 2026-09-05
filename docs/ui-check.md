# Responsive UI regression check

Run `npm run dev`, sign in, and use the browser's responsive viewport at 320, 375,
768, 1024, and 1440px. Check light and dark themes with two majors, a long plan
name, and a course with a long name/code/prerequisite note.

At each width, open the plan switcher and course picker. Menus must stay on
screen, course names must wrap, and controls must not overlap. Run this read-only
check in the browser console after transitions finish:

```js
const width = document.documentElement.clientWidth;
const overflow = [...document.querySelectorAll('.planner-shell *, .modal *')]
  .filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > width + 1);
  });
console.assert(overflow.length === 0, 'Horizontal overflow', overflow);
```

With the catalog open and all filters empty, run:

```js
console.assert(document.querySelectorAll('.modal-course-item').length === 100,
  'Initial catalog batch must contain 100 rows');
```

Click **Show more courses**, verify 200 rows with the same assertion, then search
for `data` and verify the count resets to 100. Search for `Data Structures`, use
Tab and Enter to add a result, then remove it with its named remove button.
Verify it appears/disappears in the destination semester without duplicate adds.

At 320 × 400px, switch to **Custom Course**. Fill the name, scroll to the bottom,
and verify **Add Custom Course** is reachable and adds the course. Close the
picker and open the course details from its title using the keyboard.

Local component preview checked these cases with mocked auth; this does not
verify live Clerk authentication or Supabase persistence.
