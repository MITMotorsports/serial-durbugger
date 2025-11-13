use std::any::Any;

pub trait CoerceAny {
    fn into_any(self: Box<Self>) -> Box<dyn Any>;
    
    fn as_any(&mut self) -> &mut dyn Any;
}

impl<T: 'static> CoerceAny for T {
    fn into_any(self: Box<Self>) -> Box<dyn Any> { self }

    fn as_any(&mut self) -> &mut dyn Any { self }
}
