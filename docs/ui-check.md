# Responsive UI regression check

For a first visit with one empty plan and no study-away selections, check the
three-step sample walkthrough. Next/Back must move between steps; Skip tour,
Escape, and Start blank must dismiss without adding courses. Use sample must add
four catalog courses (16 credits) to Year 1 Fall, preserving the selected majors.
Reload after dismissal: the tour must stay hidden for that user on this browser.
Existing populated plans and accounts with multiple plans must skip the tour.
At 320 × 400px in both themes, scroll the dialog and verify every action remains
reachable, text wraps without horizontal overflow, and Tab stays inside it.
Component preview checks cover these interactions in React StrictMode; live
Clerk/Supabase persistence is not covered by the preview.

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

For a requirement shortcut, click **Find**, choose a semester, and verify the
picker shows **Add Course**, that semester, and a separate matching-requirement
summary. Catalog/custom tabs and general filters should be absent. **Change
semester** must return to semester selection with the same requirement; choose
another semester and verify matching courses are added to that destination.

While choosing a semester for a requirement, scroll through all four years. The
instruction bar must remain above the scrolling board, and each sticky year
heading must be fully visible below it. Check a long requirement label at 320px;
**Cancel** must stay visible and restore the full board height when pressed.

Open **Plan → Import File** at desktop and mobile widths in both themes. The
backdrop must cover the viewport, not just the header; the dialog must be centered
on desktop and sit at the bottom on mobile. **choose a file** must open the file
chooser, and Escape / the close button must dismiss the dialog.
