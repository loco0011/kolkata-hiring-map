@include('errors.layout', [
    'title' => 'Something went wrong',
    'code' => '500',
    'message' => "Something broke on our end. It's not you — try again in a moment.",
])
