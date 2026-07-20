# Debug Session: Modal Dialog Positioning

## Symptoms
User reported that both the Trip Creation modal and the Profile Selection modal are positioned too high on the web page.

## Cause
The shared `.modal-overlay` CSS class in `global.css` is styled as a flex container:
```css
.modal-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
}
```
While `align-items: center` centers the modal vertically in the viewport, this alignment can make the modal feel visually high or unbalanced compared to standard web conventions (which typically position modals about 10-15% from the top of the viewport).

## Resolution
Modify `.modal-overlay` to use top-aligned positioning with a comfortable vertical offset:
```css
.modal-overlay {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}
```
This moves the modal down slightly on all screen sizes, providing a much more balanced and premium appearance.
