require(['a', 'b'], function (a, b) {
    a.as();
    b.bs();
}, function () {
    console.error('has error');
})